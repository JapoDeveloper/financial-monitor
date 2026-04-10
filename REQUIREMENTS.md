# Product Requirements Document (PRD): Financial Monitor

## 1. Visión del Producto
**Financial-monitor** es un sistema web integral diseñado para que los usuarios puedan analizar sus finanzas personales y explorar de forma global el mercado de valores. La plataforma consolida las transacciones de inversión del usuario y ofrece herramientas avanzadas de análisis financiero y de mercado en dashboards profesionales, homogéneos y altamente estilizados. 

El objetivo principal es reemplazar los flujos de trabajo fragmentados (actualmente basados en Jupyter Notebooks locales) por una aplicación web asíncrona, robusta, interactiva y estructurada sin acoplamientos técnicos, utilizando tecnologías modernas y escalables.

## 2. Objetivos Principales
1. **Consolidación de Datos Personales**: Integrar y visualizar de forma clara el historial completo de las transacciones de inversión y el portfolio actual (holdings) de un usuario en su moneda de elección y contra un benchmark definido.
2. **Análisis de Mercado (Screener y Charts)**: Proveer herramientas potentes para el rastreo y análisis técnico/fundamental de instrumentos financieros del mercado global (Equities, ETFs, Crypto).
3. **Migración Fiel de la Lógica Cuantitativa**: Trasladar estrictamente la lógica matemática, de cálculos y generación de métricas desde los Jupyter Notebooks existentes hacia la capa de `domain` del backend, garantizando cero acoplamiento tecnológico y completa exactitud en los cálculos.
4. **Experiencia de Usuario (UX/UI)**: Presentar la información a través de una interfaz de usuario consistente, minimalista, responsiva y con un diseño visual premium (Dark Theme, estilos consistentes).

## 3. Alcance del Sistema (Features Clave)

### 3.1. Gestión y Seguimiento de Portafolio Personal
*   **Ingesta de Transacciones**: Módulo para extraer y procesar transacciones históricas (Aportes, Retiros, Compras/Ventas, Dividendos) provenientes de la base de datos origen.
*   **Cálculo de Tenencias (Holdings)**: Computación del estado actual en tiempo real o diferido de las tenencias.
*   **Métricas de Desempeño del Portafolio**: Cálculo de rentabilidades absolutas, TWR (Time-Weighted Return), ganancias/pérdidas (P&L) en moneda base y contra un índice de referencia (e.g., SPY).

### 3.2. Dashboards de Análisis Financiero
*   **Resumen Global (Overview)**: Gráficos base del tamaño de portafolio, rendimiento contra riesgo, y *asset allocation* (Distribución por clase de activos y estilos).
*   **Análisis Individual de Activos (Asset View)**: Métricas como Retorno vs Benchmark, precio promedio y desempeño total a lo largo de un ciclo (ej: 1, 3, 5 años).

### 3.3. Herramientas de Análisis de Mercado
*   **Screener de Mercado Global**: Panel de búsqueda para investigar diferentes activos respaldados por proveedores externos (YFinance).
*   **Históricos e Indicadores Matemáticos**: Exposición visual e interactiva de Alpha, Beta, Sharpe Ratio, Information Ratio, RSI, MACD, Drawdowns Máximos y promedios móviles, calculados por el motor de dominio interno.

## 4. Requisitos No Funcionales (Especificaciones Técnicas)
*   **Clean Architecture Backend**: Aislar la inteligencia y el motor de cálculo de cualquier componente web o base de datos.
    *   `FastAPI` para capa REST asíncrona.
    *   `SQLAlchemy 2.0 (Async)` implementando patrón Repositorio para transacciones de DB MariaDB.
    *   `Pydantic v2` para validación y tipado de datos matemáticos, métricas y parámetros.
*   **Arquitectura Frontend**:
    *   Agnóstico orientada a componentes usando `React 18` + `Vite`.
    *   Diseño CSS moderno 100% puro (`CSS Modules` + Variables Centralizadas) usando modo noche predilecto. **Sin utilitarios como TailwindCSS**, garantizando la homogeneidad de la UI por cuenta propia.
    *   Gestión de estados asíncronos y memoria cache de mercado usando `@tanstack/react-query`.
    *   Visualización de datos avanzados a través de `recharts` o `plotly.js`.
*   **Deployment**: Orientado a contenedores (Docker & Docker-Compose) garantizando ejecución nativa inmediata, multi-servicio.

## 5. Estrategia de Migración
Para lograr esto, la iteración en el desarrollo consta en migrar paso a paso:
1.  **Fundación (Actual)**: Cimientos limpios de base de datos, APIs vacías y esqueleto React configurado para interactuar.
2.  **Motor Cuantitativo (Domain Engine)**: Transportar las funciones analíticas (`utils/` python files en los notebooks) al Core.
3.  **Persistencia y Servicios Externos**: Consolidar Repositorios para lectura histórica local, paralelamente a envolver APIs externas de cotizaciones.
4.  **APIs y Consumo MVC**: Exponer todos los métodos de dominio vía endpoints HTTP listos para ser consumidos.
5.  **Construcción de Interfaz UX/UI**: Creación paulatina de cada componente visual partiendo de tarjetas hasta pantallas compuestas, validando métricas 1-1 contra los notebooks originarios.
