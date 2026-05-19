import re

# Split a pasted blob on newlines, commas, semicolons, or whitespace.
_SPLIT = re.compile(r"[\s,;]+")
_CIDR = re.compile(r"^\d{1,3}(\.\d{1,3}){3}/\d{1,2}$")


def infer_asset_type(token: str) -> str:
    """Best-effort type from a raw token (host is the safe default)."""
    if "://" in token:
        return "url"
    if _CIDR.match(token):
        return "network"
    return "host"


def parse_asset_list(text: str) -> list[tuple[str, str]]:
    """Parse a pasted list into deduped (type, identifier) pairs.

    Accepts IPs, CIDRs, hostnames, and URLs separated by any whitespace,
    commas, or semicolons — the high-frequency bulk-add path.
    """
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for raw in _SPLIT.split(text or ""):
        ident = raw.strip()
        if not ident or ident in seen:
            continue
        seen.add(ident)
        out.append((infer_asset_type(ident), ident))
    return out
