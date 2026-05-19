"""Parse nmap XML into a digestible per-host structure.

Uses lxml's recovering parser so malformed / truncated / hand-edited scan
output (mismatched tags, stray closers, odd DOCTYPEs) still yields hosts.
"""

from dataclasses import dataclass, field

from lxml import etree

# Service/port signals for workstream auto-split.
# AD: directory/auth services, plus SMB (a domain-joined member is "on the
# AD network"). DNS-only is too weak to imply AD on its own.
_AD_PORTS = {88, 389, 445, 636, 3268, 3269, 464}
_AD_SVC = {
    "kerberos-sec",
    "kpasswd5",
    "ldap",
    "ldapssl",
    "globalcatldap",
    "globalcatldapssl",
    "microsoft-ds",
}
# Web: genuine web ports only. Port-gated on purpose — matching the "http"
# service name also catches WinRM (5985, "Microsoft HTTPAPI httpd") and
# http-rpc-epmap (593), which are not websites.
_WEB_PORTS = {80, 443, 8080, 8443, 8000, 8888, 4443, 8089, 8191, 3000, 5000}


@dataclass
class ParsedService:
    port: int
    protocol: str
    state: str
    name: str | None = None
    product: str | None = None
    version: str | None = None

    def as_dict(self) -> dict:
        return {
            "port": self.port,
            "protocol": self.protocol,
            "state": self.state,
            "name": self.name,
            "product": self.product,
            "version": self.version,
        }


@dataclass
class ParsedHost:
    ip: str | None
    hostname: str | None
    os: str | None
    services: list[ParsedService] = field(default_factory=list)

    @property
    def identifier(self) -> str:
        return self.hostname or self.ip or "unknown-host"

    @property
    def is_ad(self) -> bool:
        for s in self.services:
            if s.port in _AD_PORTS or (s.name or "").lower() in _AD_SVC:
                return True
        return False

    @property
    def is_web(self) -> bool:
        return any(s.port in _WEB_PORTS for s in self.services)


def parse_nmap_xml(data: bytes) -> list[ParsedHost]:
    """Tolerantly parse nmap XML into up hosts. Raises ValueError if unusable."""
    if not data or not data.strip():
        raise ValueError("Empty input")
    parser = etree.XMLParser(recover=True, huge_tree=True, resolve_entities=False)
    try:
        root = etree.fromstring(data, parser=parser)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"Unparseable nmap XML: {e}") from e
    if root is None:
        raise ValueError("Unparseable nmap XML")

    # Be tolerant of where <host> ended up after recovery.
    host_els = root.findall(".//host")
    if not host_els:
        raise ValueError("No <host> elements found — is this nmap -oX output?")

    hosts: list[ParsedHost] = []
    for host_el in host_els:
        status = host_el.find("status")
        if status is not None and status.get("state") == "down":
            continue

        ip = None
        for addr in host_el.findall("address"):
            if addr.get("addrtype") in ("ipv4", "ipv6"):
                ip = addr.get("addr")
                break

        hn = host_el.find("hostnames/hostname")
        hostname = hn.get("name") if hn is not None else None

        os_match = host_el.find("os/osmatch")
        os_name = os_match.get("name") if os_match is not None else None

        services: list[ParsedService] = []
        for port_el in host_el.findall(".//port"):
            st = port_el.find("state")
            state = st.get("state") if st is not None else "unknown"
            if state != "open":
                continue
            svc = port_el.find("service")
            try:
                portid = int(port_el.get("portid", "0"))
            except (TypeError, ValueError):
                portid = 0
            services.append(
                ParsedService(
                    port=portid,
                    protocol=port_el.get("protocol", "tcp"),
                    state=state,
                    name=svc.get("name") if svc is not None else None,
                    product=svc.get("product") if svc is not None else None,
                    version=svc.get("version") if svc is not None else None,
                )
            )

        if ip or hostname:
            hosts.append(
                ParsedHost(ip=ip, hostname=hostname, os=os_name, services=services)
            )

    if not hosts:
        raise ValueError("No usable hosts (all down or missing addresses)")
    return hosts
