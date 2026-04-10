import httpx
from bs4 import BeautifulSoup
import re
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from app.db.repositories.legacy_repo import LegacyWimmRepository
from app.schemas.currency import CurrencyRate

logger = logging.getLogger(__name__)

class CurrencyService:
    """
    Service to manage currency exchange rates.
    Handles scraping from Infodolar and synchronization with the database.
    """

    INFODOLAR_URL = "https://www.infodolar.com.do"
    HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    def __init__(self, repository: LegacyWimmRepository):
        self.repository = repository

    async def get_rates_from_db(self) -> List[CurrencyRate]:
        """Fetches all exchange rates from the database."""
        raw_rates = await self.repository.get_all_exchange_rates()
        return [CurrencyRate(**rate) for rate in raw_rates]

    async def update_rates_from_web(self) -> List[CurrencyRate]:
        """
        Scrapes Infodolar for latest rates and updates the database.
        Returns the updated list of rates.
        """
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(self.INFODOLAR_URL, headers=self.HEADERS)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                rows = soup.find_all('tr')
                
                target_row = None
                for row in rows:
                    row_text = row.get_text()
                    if "Promedio InfoDolar" in row_text:
                        target_row = row
                        break
                
                if not target_row:
                    logger.warning("Promedio InfoDolar row not found on Infodolar.")
                    return await self.get_rates_from_db()

                cells_text = [cell.get_text(strip=True) for cell in target_row.find_all(['td', 'th'])]
                full_text = " ".join(cells_text)
                logger.debug(f"Target row full text: {full_text}")
                
                # Extract rates: Look for currency symbols followed by numbers
                # Promedio InfoDolar typically has '$60.36$0.30 $62.20$0.42'
                # We want the first number of each group (the rate, not the change)
                rates = re.findall(r"\$\s*(\d{2,3}\.\d{2})", full_text)
                
                if len(rates) < 1:
                    logger.warning(f"Could not extract rates from text: {full_text}")
                    return await self.get_rates_from_db()

                buy_rate = float(rates[0])
                logger.info(f"Extracted Buy Rate: {buy_rate}")

                # Extract update timestamp from the last cell if possible, or abbr title
                update_text = "N/A"
                if len(cells_text) > 0:
                    # Look for a cell that contains 'de' and 'de' (Spanish date pattern)
                    for cell in reversed(cells_text):
                        if " de " in cell and re.search(r"\d+", cell):
                            update_text = cell
                            break
                
                if update_text == "N/A":
                    abbr_tag = target_row.find("abbr")
                    update_text = abbr_tag.get("title") if abbr_tag else "N/A"
                
                logger.debug(f"Update string found: {update_text}")
                last_updated = self._parse_spanish_date(update_text)
                
                # 1. Update USD -> DOP
                logger.info(f"Updating USD -> DOP to {buy_rate} with date {last_updated}")
                await self.repository.update_exchange_rate("USD", "DOP", buy_rate, last_updated)
                
                # 2. Update DOP -> USD (Inverse)
                inverse_rate = 1.0 / buy_rate if buy_rate > 0 else 0
                logger.info(f"Updating DOP -> USD to {inverse_rate}")
                await self.repository.update_exchange_rate("DOP", "USD", inverse_rate, last_updated)
                
                # Commit changes
                await self.repository.db.commit()
                logger.info("Database transaction committed.")
                
                # Return refreshed list
                return await self.get_rates_from_db()

        except Exception as e:
            logger.error(f"Error during currency update: {e}", exc_info=True)
            # Return current rates from DB if web update fails
            return await self.get_rates_from_db()

    def _parse_spanish_date(self, date_str: str) -> datetime:
        """Parses Spanish date string into datetime object."""
        if not date_str or date_str == "N/A":
            return datetime.now()

        months = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
            "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
            "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
        }
        
        try:
            # Try ISO format first (e.g. '2026-03-10T16:20:00-04:00')
            if 'T' in date_str and '-' in date_str:
                try:
                    # Strip timezone if present for simplicity in old DBs (or keep it if DB supports)
                    base_iso = date_str.split('-')[0] if '-' in date_str and 'T' in date_str else date_str
                    if '+' in base_iso: base_iso = base_iso.split('+')[0]
                    return datetime.fromisoformat(date_str)
                except ValueError:
                    pass

            # Try Spanish format: 'martes, 10 de marzo de 2026 4:20 p. m.'
            # Normalize: Remove dots from p.m. or a.m.
            normalized = date_str.lower().replace('.', '').replace('m', ' m')
            match = re.search(r"(\d+) de (\w+) de (\d+) (\d+):(\d+) ([ap])", normalized, re.IGNORECASE)
            if match:
                day, month_name, year, hour, minute, period = match.groups()
                
                h = int(hour)
                if period.lower() == 'p' and h != 12: 
                    h += 12
                elif period.lower() == 'a' and h == 12: 
                    h = 0
                    
                month = months.get(month_name.lower(), 1)
                return datetime(int(year), month, int(day), h, int(minute))
                
            return datetime.now()
        except Exception as e:
            logger.warning(f"Failed to parse date '{date_str}': {e}. Using current time.")
            return datetime.now()
