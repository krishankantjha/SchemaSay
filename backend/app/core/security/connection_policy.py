"""Security policy for user-supplied database connection targets."""

from __future__ import annotations

import ipaddress
import socket
from pathlib import Path
from typing import Iterable

from app.config import settings

SUPPORTED_DB_TYPES = frozenset({"postgresql", "mysql", "mssql", "sqlite", "file_upload"})
REMOTE_DB_TYPES = frozenset({"postgresql", "mysql", "mssql"})


def _split_values(value: str) -> set[str]:
    return {item.strip().lower().rstrip(".") for item in value.split(",") if item.strip()}


def _split_paths(value: str) -> tuple[str, ...]:
    """Split filesystem roots without lowercasing case-sensitive path components."""
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _sqlite_roots() -> tuple[Path, ...]:
    configured = _split_paths(settings.ALLOWED_SQLITE_ROOTS)
    if not configured:
        configured = {settings.SQLITE_DATA_DIR}
    return tuple(Path(item).expanduser().resolve(strict=False) for item in configured)


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def validate_sqlite_path(database_name: str, *, must_exist: bool = False) -> str:
    """Return a canonical SQLite path confined to an approved application directory."""
    if not database_name or len(database_name) > 4096:
        raise ValueError("SQLite database path is required and must be at most 4096 characters")

    raw = Path(database_name).expanduser()
    if not raw.is_absolute():
        raw = Path(settings.SQLITE_DATA_DIR).expanduser() / raw

    candidate = raw.resolve(strict=False)
    roots = _sqlite_roots()
    if not any(_is_within(candidate, root) for root in roots):
        raise ValueError("SQLite database path must be inside an approved application data directory")

    if candidate.suffix.lower() not in {".db", ".sqlite", ".sqlite3"}:
        raise ValueError("SQLite database files must use a .db, .sqlite, or .sqlite3 extension")
    if candidate.exists() and not candidate.is_file():
        raise ValueError("SQLite database path must refer to a regular file")
    if must_exist and not candidate.is_file():
        raise ValueError("SQLite database file does not exist")

    candidate.parent.mkdir(parents=True, exist_ok=True)
    return str(candidate)


def _resolved_addresses(host: str) -> set[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    try:
        literal = ipaddress.ip_address(host)
        return {literal}
    except ValueError:
        pass

    try:
        records = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ValueError("Database host could not be resolved") from exc

    addresses: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()
    for record in records:
        try:
            addresses.add(ipaddress.ip_address(record[4][0]))
        except (IndexError, ValueError):
            continue
    if not addresses:
        raise ValueError("Database host could not be resolved")
    return addresses


def _allowed_host(host: str, addresses: Iterable[object]) -> bool:
    allowlist = _split_values(settings.ALLOWED_DB_HOSTS)
    if not allowlist:
        return False
    if host.lower().rstrip(".") in allowlist:
        return True
    return any(str(address).lower() in allowlist for address in addresses)


def validate_remote_host(host: str) -> str:
    """Validate an outbound database host against an explicit production policy."""
    normalized = (host or "").strip().lower().rstrip(".")
    if not normalized or len(normalized) > 253:
        raise ValueError("Database host is required and must be a valid hostname or IP address")
    if any(char.isspace() for char in normalized) or "/" in normalized or "\\" in normalized:
        raise ValueError("Database host must not contain whitespace or path separators")

    # Test fixtures may use synthetic/private hosts, but this flag is never enabled by default.
    if settings.TESTING:
        return normalized

    addresses = _resolved_addresses(normalized)
    if _allowed_host(normalized, addresses):
        return normalized

    if settings.REQUIRE_DB_HOST_ALLOWLIST:
        raise ValueError("Database host is not present in the configured database-host allowlist")

    if not settings.ALLOWED_DB_HOSTS:
        if any(
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
            or address.is_unspecified
            for address in addresses
        ):
            raise ValueError("Private, loopback, link-local, and reserved database hosts are blocked")
        return normalized

    raise ValueError("Database host is not present in the configured database-host allowlist")


def validate_database_target(db_type: str, host: str | None, database_name: str, *, must_exist: bool = False) -> str:
    """Validate and canonicalize the target-specific database identifier."""
    normalized_type = (db_type or "").strip().lower()
    if normalized_type not in SUPPORTED_DB_TYPES:
        raise ValueError("Unsupported database connection type")
    if normalized_type in REMOTE_DB_TYPES:
        validate_remote_host(host or "")
        return database_name
    if normalized_type in {"sqlite", "file_upload"}:
        return validate_sqlite_path(database_name, must_exist=must_exist)
    return database_name
