import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging
import json
import os
import time
import shutil

logger = logging.getLogger(__name__)

# Persistence for price results - unique to this project
CACHE_FILE = os.path.expanduser("~/.financial_monitor_price_cache.json")

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading price cache: {e}")
            return {}
    return {}

def save_cache(cache):
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f)
    except Exception as e:
        logger.error(f"Error saving price cache: {e}")

def clear_yf_cache():
    """Clears yfinance internal cache to reset crumbs/cookies."""
    try:
        paths = [
            os.path.expanduser('~/.cache/py-yfinance'),
            os.path.expanduser('~/Library/Caches/py-yfinance')
        ]
        for p in paths:
            if os.path.exists(p):
                shutil.rmtree(p)
                logger.info(f"Cleared yfinance cache at {p}")
    except Exception as e:
        logger.warning(f"Could not clear yfinance cache: {e}")

def get_asset_price_label(history):
    """Identifies the price column label in the history dataframe."""
    if history is None or history.empty: return None
    
    # Handle MultiIndex columns (common in yfinance batch downloads)
    cols = history.columns
    if isinstance(cols, pd.MultiIndex):
        # Flatten levels to check for Close/Adj Close
        level_values = [v.lower() for v in cols.get_level_values(0).unique()]
        if 'adj close' in level_values: return 'Adj Close'
        if 'close' in level_values: return 'Close'
    else:
        # Standard Index
        level_values = [v.lower() for v in cols]
        if 'adj close' in level_values: return 'Adj Close'
        if 'close' in level_values: return 'Close'
        
    return None

def get_assets_last_price_for_period(tickers, year: int, month: int):
    """
    Fetches the closing price of a month using yfinance 1.2.0+.
    Optimized for stability and speed with bulk downloading and local caching.
    Returns: {ticker: {"price": float, "date": str}}
    """
    if not tickers:
        return {}

    cache = load_cache()
    target_month_str = f"{year}-{month:02d}"
    results = {}
    
    # Normalize tickers and keep mapping
    ticker_map = {t.strip().upper(): t for t in tickers}
    normalized_tickers = list(ticker_map.keys())
    remaining_tickers = []
    
    for norm_t in normalized_tickers:
        origin_t = ticker_map[norm_t]
        cache_key = f"{norm_t}_{target_month_str}"
        if cache_key in cache:
            cached_val = cache[cache_key]
            if isinstance(cached_val, dict):
                results[origin_t] = cached_val
            else:
                results[origin_t] = {"price": cached_val, "date": None}
        else:
            remaining_tickers.append(norm_t)
            
    if not remaining_tickers:
        return results

    # Date range for fetching data
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 15)
    else:
        end_date = datetime(year, month + 1, 15)
    
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    last_day_of_month = (datetime(year, month, 1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)

    logger.info(f"YF 1.2.0 Download Attempt for: {remaining_tickers} ({start_str} to {end_str})")

    try:
        hist_data = yf.download(
            remaining_tickers,
            start=start_str,
            end=end_str,
            group_by='ticker',
            progress=False,
            auto_adjust=True,
            threads=True
        )
        
        if hist_data.empty:
            logger.warning("YF 1.2.0: Download returned empty DataFrame")
        else:
            logger.info(f"YF 1.2.0: Downloaded data for {len(remaining_tickers)} tickers.")

        for norm_t in remaining_tickers:
            origin_t = ticker_map[norm_t]
            ticker_data = pd.DataFrame()
            
            if not hist_data.empty:
                if isinstance(hist_data.columns, pd.MultiIndex):
                    if norm_t in hist_data.columns.get_level_values(0):
                        ticker_data = hist_data[norm_t].dropna()
                else:
                    ticker_data = hist_data.dropna()
            
            if ticker_data.empty:
                logger.info(f"YF 1.2.0: trying individual Ticker fallback for {norm_t}")
                time.sleep(1) 
                tk = yf.Ticker(norm_t)
                ticker_data = tk.history(start=start_str, end=end_str, auto_adjust=True)
                
            if ticker_data.empty:
                logger.warning(f"YF 1.2.0: No data found for {norm_t}")
                results[origin_t] = {"price": float('nan'), "date": None}
                continue

            price_col = get_asset_price_label(ticker_data)
            if not price_col:
                logger.warning(f"YF 1.2.0: No recognized price column for {norm_t}")
                results[origin_t] = {"price": float('nan'), "date": None}
                continue

            ticker_data.index = pd.to_datetime(ticker_data.index)
            month_data = ticker_data[ticker_data.index.strftime('%Y-%m') == target_month_str]
            
            price_val = None
            price_date = None
            if not month_data.empty:
                price_val = round(float(month_data[price_col].iloc[-1]), 6)
                price_date = month_data.index[-1].strftime('%Y-%m-%d')
            else:
                closest_data = ticker_data[ticker_data.index <= pd.Timestamp(last_day_of_month)]
                if not closest_data.empty:
                    price_val = round(float(closest_data[price_col].iloc[-1]), 6)
                    price_date = closest_data.index[-1].strftime('%Y-%m-%d')
            
            if price_val is not None:
                entry = {"price": price_val, "date": price_date}
                results[origin_t] = entry
                cache[f"{norm_t}_{target_month_str}"] = entry
                logger.info(f"YF 1.2.0: Found price for {norm_t}: {price_val} on {price_date}")
            else:
                results[origin_t] = {"price": float('nan'), "date": None}

    except Exception as e:
        logger.error(f"YF 1.2.0 Download Error: {e}")
        for t in remaining_tickers:
            results[ticker_map[t]] = {"price": float('nan'), "date": None}

    save_cache(cache)
    return results

def get_asset_dividends_for_period(ticker: str, year: int, month: int):
    """
    Fetches dividends for a specific ticker and period from Yahoo Finance.
    Returns: List of {"date": str, "amount": float}
    """
    cache = load_cache()
    target_month_str = f"{year}-{month:02d}"
    cache_key = f"{ticker.upper()}_DIV_{target_month_str}"
    
    if cache_key in cache:
        return cache[cache_key]
        
    try:
        logger.info(f"YF: Fetching dividends for {ticker} in {target_month_str}")
        tk = yf.Ticker(ticker)
        divs = tk.dividends
        
        # Filter for the target month
        month_divs = divs[divs.index.strftime('%Y-%m') == target_month_str]
        
        results = []
        if not month_divs.empty:
            for item_date, amount in month_divs.items():
                results.append({
                    "date": item_date.strftime('%Y-%m-%d'),
                    "amount": round(float(amount), 6)
                })
        
        # Cache the result (even if empty to avoid re-fetching)
        cache[cache_key] = results
        save_cache(cache)
        return results
        
    except Exception as e:
        logger.error(f"YF Dividend Fetch Error for {ticker}: {e}")
        return []

import re

def get_asset_thematic_metadata(info):
    """
    Enhanced classification engine using prioritized matching.
    Uses yfinance 'category' as a primary hint and refined regex for context.
    """
    summary = (info.get('longBusinessSummary') or info.get('description') or '').lower()
    category = (info.get('category') or '').lower()
    name = (info.get('shortName') or info.get('longName') or '').lower()
    index_name = (info.get('underlyingIndexName') or '').lower()
    
    # Combined text for regex fallback
    all_text = f"{summary} {category} {name} {index_name}"
    
    # 1. Region Detection (Prioritized)
    region_spec = "Global"
    
    # Strong hints from category
    is_foreign = "foreign" in category or "international" in category
    is_emerging_cat = "emerging" in category
    is_us_cat = any(x in category for x in ["u.s.", "us ", "america"]) and not is_foreign
    
    # Ex-US and International markers
    ex_us_patterns = [
        r'\bex-us\b', r'\bex-u\.s\.\b', r'\bex-usa\b', r'\bnon-u\.s\.\b', 
        r'\bnon-us\b', r'outside the u\.s\.', r'outside the united states'
    ]
    is_ex_us_text = any(re.search(p, all_text) for p in ex_us_patterns)
    
    # Improved U.S. markers
    us_patterns = [r'\bunited states\b', r'\bu\.s\.', r'\busa\b', r'\bdomestic\b']
    is_us_text = any(re.search(p, all_text) for p in us_patterns)
    is_global_text = any(x in all_text for x in ['global', 'world', 'all-country', 'all country', 'total world'])

    # Decision tree
    if is_emerging_cat or "emerging markets" in all_text:
        region_spec = "Global Emerging"
    elif "china" in all_text and not "excluding china" in all_text:
        region_spec = "China"
    elif is_us_cat or (is_us_text and not is_foreign and not is_ex_us_text):
        region_spec = "U.S."
    elif is_global_text or "global" in category or "world" in category:
        if is_us_cat or is_us_text:
            region_spec = "Global (Incl. US)"
        else:
            region_spec = "Global"
    elif is_foreign or is_ex_us_text or "developed markets" in all_text:
        if "europe" in all_text and not any(x in all_text for x in ["pacific", "japan", "asia", "developed markets"]):
            region_spec = "Europe"
        else:
            region_spec = "Developed Ex-U.S."

    # 2. Focus Detection (Size) - Priority: Category > Specific Keywords
    if "small" in category: focus = "Small Cap"
    elif "mid" in category: focus = "Mid Cap"
    elif "large" in category: focus = "Large Cap"
    elif "all cap" in category: focus = "All Cap"
    elif "total stock" in all_text or "all cap" in all_text: focus = "All Cap"
    elif "500" in all_text or "100" in all_text or "large cap" in all_text: focus = "Large Cap"
    elif "mid cap" in all_text: focus = "Mid Cap"
    elif "small cap" in all_text: focus = "Small Cap"
    else: focus = "All Cap"
    
    # 3. Niche Detection (Factor / Style)
    niche = "Blend"
    
    # Specialized Bond categories
    if "government" in category or "treasury" in all_text:
        if any(x in all_text for x in ["tips", "inflation-protected"]) and not any(x in all_text for x in ["excluding", "not including"]):
            niche = "TIPS"
        else:
            niche = "Treasury"
    elif "commodity" in category or "precious metals" in category or "gold" in all_text:
        niche = "Commodities"
    elif "real estate" in category or "reit" in all_text:
        niche = "Real Estate"
    else:
        # Standard factors
        factors = {
            "Quality": [r'\bquality\b'],
            "Momentum": [r'\bmomentum\b'],
            "Value": [r'\bvalue\b'],
            "Growth": [r'\bgrowth\b'],
            "Yield": [r'\bdividend\b', r'\byield\b', r'\bincome\b'],
            "Volatility": [r'\blow volatility\b', r'\bminimum volatility\b'],
        }
        
        found_niche = []
        for f_name, f_patterns in factors.items():
            if any(re.search(p, all_text) for p in f_patterns):
                found_niche.append(f_name)
        
        if found_niche:
            if len(found_niche) > 1:
                niche = " / ".join(found_niche[:2])
            else:
                niche = found_niche[0]
        elif any(x in all_text for x in ['bitcoin', 'ethereum', 'crypto', 'blockchain']):
            niche = "Cripto"
        elif any(x in all_text for x in ['core', 'total stock', 'blend']):
            niche = "Blend"

    return {
        'focus': focus,
        'niche': niche,
        'region_spec': region_spec
    }

def get_asset_supports_info(symbol, all_history_data):
    """
    Identifies support and resistance levels using a rolling window approach.
    """
    if symbol not in all_history_data.columns.get_level_values(0):
        return {'support': 0.0, 'resistance': 0.0, 'dist_to_support': 0.0, 'dist_to_resistance': 0.0}
        
    full_hist = all_history_data[symbol].dropna()
    if full_hist.empty:
        return {'support': 0.0, 'resistance': 0.0, 'dist_to_support': 0.0, 'dist_to_resistance': 0.0}

    one_year_ago = full_hist.index[-1] - timedelta(days=365)
    hist = full_hist.loc[one_year_ago:].copy()
    
    window = 20  
    price_label = get_asset_price_label(hist)
    curr = float(hist[price_label].iloc[-1])
    
    # Identify local minima as supports
    hist.loc[:, 'Support_Roll'] = hist['Low'].rolling(window=window, min_periods=1).min()
    supports = hist[hist['Low'] == hist['Support_Roll']]['Low'].unique()
    lower_supports = [s for s in supports if s < curr]
    main_support = float(max(lower_supports, default=hist['Low'].min()))
    
    # Identify local maxima as resistances
    hist.loc[:, 'Resist_Roll'] = hist['High'].rolling(window=window, min_periods=1).max()
    resistances = hist[hist['High'] == hist['Resist_Roll']]['High'].unique()
    upper_resistances = [r for r in resistances if r > curr]
    main_resistance = float(min(upper_resistances, default=curr))
    
    dist_to_sup = abs(((curr - main_support) / main_support) * 100) if main_support > 0 else 0.0
    dist_to_res = abs(((main_resistance - curr) / curr) * 100) if curr > 0 else 0.0
    
    return {
        'support': main_support, 
        'resistance': main_resistance, 
        'dist_to_support': dist_to_sup, 
        'dist_to_resistance': dist_to_res
    }
