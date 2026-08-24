"""
SchemaSay — Streamlit Cloud Entry Point
Bundles and renders the production Vanilla HTML/CSS/JS frontend inside Streamlit Cloud.
"""

import json
import os
import re
import pathlib
from urllib.parse import urlparse
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="SchemaSay — Ask your database",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Hide Streamlit default UI elements (header, footer, padding)
st.markdown("""
    <style>
        #MainMenu {visibility: hidden;}
        header {visibility: hidden;}
        footer {visibility: hidden;}
        .block-container {
            padding-top: 0rem !important;
            padding-bottom: 0rem !important;
            padding-left: 0rem !important;
            padding-right: 0rem !important;
            max-width: 100% !important;
        }
        iframe {
            border: none !important;
        }
    </style>
""", unsafe_allow_html=True)


def _runtime_secret(name, default=""):
    """Read a Streamlit root secret or environment variable without exposing its value."""
    value = os.getenv(name)
    if value is not None and value.strip():
        return value.strip()

    try:
        secret_value = st.secrets.get(name)
    except (FileNotFoundError, AttributeError):
        secret_value = None
    if secret_value is None:
        return default
    return str(secret_value).strip() or default


def get_bundled_html():
    """Reads index.html and inlines local CSS/JS files so relative assets work inside Streamlit iframe."""
    base_dir = pathlib.Path(__file__).parent.resolve()
    index_path = base_dir / "index.html"

    if not index_path.exists():
        return "<h1>Error: index.html not found</h1>"

    html_content = index_path.read_text(encoding="utf-8")
    demo_mode = _runtime_secret("SCHEMASAY_DEMO_MODE", "false").lower() == "true"
    environment = _runtime_secret("SCHEMASAY_ENV", "development").lower()
    api_base_url = _runtime_secret("SCHEMASAY_API_BASE_URL")
    if not api_base_url:
        legacy_backend_url = _runtime_secret("BACKEND_URL")
        if legacy_backend_url:
            api_base_url = f"{legacy_backend_url.rstrip('/')}/api/v1"
        else:
            api_base_url = "http://localhost:8000/api/v1"
    api_base_url = api_base_url.rstrip("/")
    parsed_api_url = urlparse(api_base_url)
    if parsed_api_url.scheme not in {"http", "https"} or not parsed_api_url.netloc:
        raise RuntimeError("SCHEMASAY_API_BASE_URL must be an absolute HTTP or HTTPS URL")
    if environment == "production" and parsed_api_url.scheme != "https":
        raise RuntimeError("SCHEMASAY_API_BASE_URL must use HTTPS in production")

    config = {
        "demoMode": demo_mode,
        "apiBaseUrl": api_base_url,
        "environment": environment,
    }
    config_script = f"<script>window.SCHEMASAY_CONFIG = {json.dumps(config)};</script>"
    html_content = html_content.replace("</head>", f"{config_script}</head>", 1)

    # Replace local CSS links with inlined <style> blocks
    def replace_css(match):
        css_rel_path = match.group(1)
        css_file = base_dir / css_rel_path
        if css_file.exists():
            return f"<style>\n/* {css_rel_path} */\n{css_file.read_text(encoding='utf-8')}\n</style>"
        return match.group(0)

    html_content = re.sub(r'<link\s+rel="stylesheet"\s+href="(css/[^"]+)">\s*', replace_css, html_content)

    # Replace local JS script tags with inlined <script> blocks
    def replace_js(match):
        js_rel_path = match.group(1)
        js_file = base_dir / js_rel_path
        if js_file.exists():
            return f"<script>\n/* {js_rel_path} */\n{js_file.read_text(encoding='utf-8')}\n</script>"
        return match.group(0)

    html_content = re.sub(r'<script\s+src="(js/[^"]+)"></script>\s*', replace_js, html_content)

    return html_content


# Render the bundled web application inside full-screen iframe
bundled_html = get_bundled_html()
components.html(bundled_html, height=1000, scrolling=True)
