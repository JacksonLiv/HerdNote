import type { WorkstreamKind } from "../api/client";

export type CaptureFieldType =
  | "text"
  | "longtext"
  | "select"
  | "number"
  | "checkbox";

export interface CaptureField {
  key: string;
  label: string;
  type: CaptureFieldType;
  options?: string[];
  placeholder?: string;
}

export interface CaptureSchema {
  title: string;
  fields: CaptureField[];
}

export interface PlaybookTask {
  key: string;
  label: string;
  hint?: string;
  capture?: CaptureSchema;
}

export interface PlaybookCategory {
  key: string;
  label: string;
  tasks: PlaybookTask[];
}

export interface PlaybookKindCatalog {
  categories: PlaybookCategory[];
}

const T = (
  key: string,
  label: string,
  hint?: string,
  capture?: CaptureSchema,
): PlaybookTask => ({ key, label, hint, capture });

const adCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "ad.foothold",
      label: "Initial Foothold",
      tasks: [
        T(
          "ad.foothold.kerberoast",
          "Kerberoasting",
          "Request SPN tickets, crack offline.",
          {
            title: "Kerberoast hash",
            fields: [
              { key: "spn", label: "SPN / service account", type: "text" },
              { key: "hash", label: "Hash (Kerberos $krb5tgs$23$...)", type: "longtext" },
              { key: "cracked", label: "Cracked password (if any)", type: "text" },
            ],
          },
        ),
        T("ad.foothold.asreproast", "AS-REPRoasting", "Find users with pre-auth disabled.", {
          title: "AS-REP hash",
          fields: [
            { key: "user", label: "Username", type: "text" },
            { key: "hash", label: "Hash ($krb5asrep$23$...)", type: "longtext" },
            { key: "cracked", label: "Cracked password", type: "text" },
          ],
        }),
        T("ad.foothold.null_session", "SMB null sessions", "Enumerate users/shares anonymously."),
        T("ad.foothold.llmnr", "LLMNR/NBT-NS poisoning", "Capture Net-NTLMv2 hashes from broadcast queries."),
        T("ad.foothold.sysvol", "Exposed creds in SYSVOL / GPP", "Look for cpassword in Group Policy Preferences."),
        T("ad.foothold.gmsa", "gMSA readable passwords"),
        T("ad.foothold.prewin2k", "Pre-Windows 2000 compat accounts"),
        T("ad.foothold.spray", "Password spray (domain)", "Mind lockout thresholds. Use kerbrute or spray-ad.", {
          title: "Spray results",
          fields: [
            { key: "tool", label: "Tool", type: "text" },
            { key: "userlist", label: "Userlist size", type: "number" },
            { key: "password", label: "Password tried", type: "text" },
            { key: "hits", label: "Hits (user:pass)", type: "longtext" },
          ],
        }),
      ],
    },
    {
      key: "ad.enum",
      label: "Enumeration",
      tasks: [
        T("ad.enum.bloodhound", "BloodHound collection", "Run SharpHound/AzureHound, ingest.", {
          title: "BloodHound run",
          fields: [
            { key: "collector", label: "Collector", type: "select", options: ["SharpHound", "AzureHound", "BloodHound.py"] },
            { key: "scope", label: "Collection method (All / DCOnly / etc.)", type: "text" },
            { key: "file", label: "Output filename", type: "text" },
          ],
        }),
        T("ad.enum.trusts", "Domain trusts"),
        T("ad.enum.gpo", "GPO review"),
        T("ad.enum.adcs", "AD CS template review", "Check ESC1-ESC15 conditions.", {
          title: "ADCS template",
          fields: [
            { key: "template", label: "Template name", type: "text" },
            { key: "vuln", label: "ESC class", type: "select", options: ["ESC1", "ESC2", "ESC3", "ESC4", "ESC6", "ESC7", "ESC8", "ESC9", "ESC10", "ESC11", "ESC13", "ESC15"] },
            { key: "principal", label: "Vulnerable principal(s)", type: "longtext" },
          ],
        }),
        T("ad.enum.acl", "ACL review (PowerView / BloodHound)"),
        T("ad.enum.laps", "LAPS readers"),
        T("ad.enum.gpo_abuse", "GPO abuse (GPMC / PowerView)", "Look for write rights on GPO objects that apply to high-value OUs.", {
          title: "Abusable GPO",
          fields: [
            { key: "gpo", label: "GPO name", type: "text" },
            { key: "applies_to", label: "Applies to (OU/scope)", type: "text" },
            { key: "right", label: "Right you have", type: "text" },
          ],
        }),
      ],
    },
    {
      key: "ad.privesc",
      label: "Privilege Escalation",
      tasks: [
        T("ad.privesc.dacl", "DACL abuse path", undefined, {
          title: "DACL abuse",
          fields: [
            { key: "principal", label: "Controlled principal", type: "text" },
            { key: "target", label: "Target object", type: "text" },
            { key: "right", label: "Right abused (GenericAll / WriteDACL / ...)", type: "text" },
            { key: "cmd", label: "Command used", type: "longtext" },
          ],
        }),
        T("ad.privesc.delegation", "Unconstrained / constrained delegation"),
        T("ad.privesc.rbcd", "Resource-based constrained delegation (RBCD)"),
        T("ad.privesc.adcs", "ADCS abuse (ESC1/8/9/11)"),
        T("ad.privesc.printnightmare", "PrintNightmare / SeImpersonate"),
        T("ad.privesc.petitpotam", "PetitPotam → relay"),
      ],
    },
    {
      key: "ad.da",
      label: "Domain Admin",
      tasks: [
        T("ad.da.dcsync", "DCSync", undefined, {
          title: "DCSync result",
          fields: [
            { key: "user_used", label: "Principal used", type: "text" },
            { key: "dumped", label: "Accounts dumped", type: "longtext" },
          ],
        }),
        T("ad.da.golden", "Golden ticket", undefined, {
          title: "Golden ticket",
          fields: [
            { key: "krbtgt", label: "krbtgt hash", type: "text" },
            { key: "ticket_file", label: "Ticket .kirbi/.ccache", type: "text" },
          ],
        }),
        T("ad.da.silver", "Silver ticket"),
        T("ad.da.adminsdholder", "AdminSDHolder ACL"),
        T("ad.da.targeted_kerberoast", "Targeted Kerberoast on DA service"),
        T("ad.da.ntds", "NTDS.dit acquisition", "secretsdump / NTDSUTIL / VSS shadow copy dump.", {
          title: "NTDS dump",
          fields: [
            { key: "method", label: "Method", type: "select", options: ["secretsdump", "NTDSUTIL", "VSS", "other"] },
            { key: "dc", label: "DC targeted", type: "text" },
            { key: "count", label: "Hashes extracted", type: "number" },
          ],
        }),
      ],
    },
    {
      key: "ad.lateral",
      label: "Lateral Movement",
      tasks: [
        T("ad.lateral.psexec", "PsExec / SMBexec", undefined, {
          title: "Lateral execution",
          fields: [
            { key: "src", label: "Source host", type: "text" },
            { key: "dst", label: "Destination host", type: "text" },
            { key: "user", label: "User", type: "text" },
            { key: "cmd", label: "Command", type: "longtext" },
          ],
        }),
        T("ad.lateral.wmiexec", "WMIExec"),
        T("ad.lateral.winrm", "WinRM / Evil-WinRM"),
        T("ad.lateral.rdp", "RDP"),
        T("ad.lateral.pth", "Pass-the-hash", undefined, {
          title: "PtH",
          fields: [
            { key: "user", label: "User", type: "text" },
            { key: "hash", label: "Hash", type: "text" },
            { key: "target", label: "Target", type: "text" },
          ],
        }),
        T("ad.lateral.ptt", "Pass-the-ticket"),
        T("ad.lateral.opth", "Overpass-the-hash"),
      ],
    },
    {
      key: "ad.persist",
      label: "Persistence",
      tasks: [
        T("ad.persist.skeleton", "Skeleton key"),
        T("ad.persist.golden", "Golden ticket dropped"),
        T("ad.persist.adminsdholder", "AdminSDHolder"),
        T("ad.persist.shadow", "Shadow credentials (msDS-KeyCredentialLink)"),
        T("ad.persist.sidhistory", "SID history"),
        T("ad.persist.new_da", "New DA created"),
      ],
    },
    {
      key: "ad.loot",
      label: "Loot",
      tasks: [
        T("ad.loot.lsass", "LSASS dump"),
        T("ad.loot.ntds", "NTDS.dit + SYSTEM hive"),
        T("ad.loot.dpapi", "DPAPI secrets"),
        T("ad.loot.sam", "SAM / SECURITY hives"),
        T("ad.loot.gmsa", "gMSA secrets"),
        T("ad.loot.ccache", "CCACHE / ticket files"),
        T("ad.loot.browser", "Browser-stored credentials"),
      ],
    },
  ],
};

const webCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "web.recon",
      label: "Recon",
      tasks: [
        T("web.recon.subdomains", "Subdomain enumeration"),
        T("web.recon.dirbust", "Dirbuster / ffuf", undefined, {
          title: "Dirbust hit",
          fields: [
            { key: "url", label: "URL", type: "text" },
            { key: "status", label: "Status code", type: "number" },
            { key: "size", label: "Size / interesting", type: "text" },
          ],
        }),
        T("web.recon.tech", "Tech fingerprint (Wappalyzer / whatweb)"),
        T("web.recon.robots", "robots.txt / sitemap.xml"),
        T("web.recon.js", "JS endpoint scrape (linkfinder / getjs)"),
      ],
    },
    {
      key: "web.auth",
      label: "Authentication",
      tasks: [
        T("web.auth.defaults", "Default creds list", undefined, {
          title: "Default credential",
          fields: [
            { key: "app", label: "App / vendor", type: "text" },
            { key: "user", label: "User", type: "text" },
            { key: "pass", label: "Password", type: "text" },
            { key: "works", label: "Works?", type: "checkbox" },
          ],
        }),
        T("web.auth.brute", "Brute force / password spray"),
        T("web.auth.session", "Session handling (fixation, predictable IDs)"),
        T("web.auth.jwt", "Weak JWT (alg=none, weak secret, kid abuse)"),
        T("web.auth.oauth", "OAuth / SSO flaws"),
        T("web.auth.reset", "Password reset abuse"),
      ],
    },
    {
      key: "web.authz",
      label: "Authorization",
      tasks: [
        T("web.authz.idor", "IDOR", undefined, {
          title: "IDOR",
          fields: [
            { key: "endpoint", label: "Endpoint", type: "text" },
            { key: "victim_id", label: "Victim ID", type: "text" },
            { key: "attacker_id", label: "Attacker ID", type: "text" },
            { key: "evidence", label: "Evidence", type: "longtext" },
          ],
        }),
        T("web.authz.vertical", "Vertical privesc (user → admin)"),
        T("web.authz.horizontal", "Horizontal privesc"),
        T("web.authz.func_level", "Missing function-level access control"),
      ],
    },
    {
      key: "web.injection",
      label: "Injection",
      tasks: [
        T("web.injection.sqli", "SQLi", undefined, {
          title: "SQLi",
          fields: [
            { key: "endpoint", label: "Endpoint", type: "text" },
            { key: "payload", label: "Payload", type: "longtext" },
            { key: "dbms", label: "DBMS", type: "text" },
          ],
        }),
        T("web.injection.nosqli", "NoSQLi"),
        T("web.injection.cmd", "Command injection", undefined, {
          title: "Command injection",
          fields: [
            { key: "endpoint", label: "Endpoint", type: "text" },
            { key: "payload", label: "Payload", type: "longtext" },
            { key: "output", label: "Output", type: "longtext" },
          ],
        }),
        T("web.injection.ssti", "SSTI"),
        T("web.injection.xxe", "XXE"),
        T("web.injection.ldap", "LDAP injection"),
        T("web.injection.crlf", "CRLF injection"),
      ],
    },
    {
      key: "web.client",
      label: "Client-side",
      tasks: [
        T("web.client.xss_reflected", "Reflected XSS", undefined, {
          title: "Reflected XSS",
          fields: [
            { key: "url", label: "URL", type: "text" },
            { key: "payload", label: "Payload", type: "longtext" },
            { key: "sink", label: "Sink / context", type: "text" },
          ],
        }),
        T("web.client.xss_stored", "Stored XSS"),
        T("web.client.xss_dom", "DOM XSS"),
        T("web.client.csrf", "CSRF"),
        T("web.client.clickjack", "Clickjacking"),
        T("web.client.cors", "CORS misconfig"),
      ],
    },
    {
      key: "web.logic",
      label: "Business Logic / Files",
      tasks: [
        T("web.logic.race", "Race condition"),
        T("web.logic.price", "Price / quantity manipulation"),
        T("web.logic.upload", "Unrestricted file upload", undefined, {
          title: "File upload",
          fields: [
            { key: "endpoint", label: "Endpoint", type: "text" },
            { key: "file", label: "File / extension", type: "text" },
            { key: "executes", label: "Executes server-side?", type: "checkbox" },
          ],
        }),
        T("web.logic.path", "LFI / RFI / path traversal"),
      ],
    },
    {
      key: "web.serverside",
      label: "Server-side",
      tasks: [
        T("web.serverside.ssrf", "SSRF", undefined, {
          title: "SSRF",
          fields: [
            { key: "endpoint", label: "Endpoint", type: "text" },
            { key: "hit", label: "Internal target reached", type: "text" },
          ],
        }),
        T("web.serverside.ssrf_cloud", "SSRF → cloud metadata"),
        T("web.serverside.deserialize", "Insecure deserialization"),
        T("web.serverside.rce", "RCE chain"),
      ],
    },
    {
      key: "web.api",
      label: "API specifics",
      tasks: [
        T("web.api.graphql", "GraphQL introspection / batching", undefined, {
          title: "GraphQL finding",
          fields: [
            { key: "endpoint", label: "GraphQL endpoint", type: "text" },
            { key: "introspection", label: "Introspection enabled?", type: "checkbox" },
            { key: "batching", label: "Batching abuse?", type: "checkbox" },
            { key: "finding", label: "What was found", type: "longtext" },
          ],
        }),
        T("web.api.mass_assign", "Mass assignment"),
        T("web.api.ratelimit", "Missing rate limit"),
        T("web.api.errors", "Verbose errors / stack traces"),
        T("web.api.websocket", "WebSocket security", "Test WS auth, message injection, CSWSH.", {
          title: "WebSocket finding",
          fields: [
            { key: "endpoint", label: "WS endpoint", type: "text" },
            { key: "auth", label: "Auth mechanism", type: "text" },
            { key: "finding", label: "Finding", type: "longtext" },
          ],
        }),
      ],
    },
    {
      key: "web.headers",
      label: "Security Headers & Config",
      tasks: [
        T("web.headers.csp", "Content-Security-Policy review"),
        T("web.headers.hsts", "HSTS missing / short maxage"),
        T("web.headers.xfo", "X-Frame-Options / clickjacking"),
        T("web.headers.cache", "Sensitive data in cache-control"),
        T("web.headers.server", "Server / X-Powered-By disclosure"),
        T("web.headers.cookies", "Cookie flags (Secure / HttpOnly / SameSite)"),
      ],
    },
    {
      key: "web.mfa",
      label: "MFA Bypass",
      tasks: [
        T("web.mfa.fatigue", "Push notification fatigue"),
        T("web.mfa.otp_brute", "OTP brute / rate limit missing"),
        T("web.mfa.backup_codes", "Backup codes guessable / exposed"),
        T("web.mfa.evilginx", "Reverse proxy (EvilGinx / Modlishka)", undefined, {
          title: "MFA bypass",
          fields: [
            { key: "target", label: "Target app", type: "text" },
            { key: "session", label: "Session token captured", type: "checkbox" },
          ],
        }),
      ],
    },
  ],
};

const externalCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "ext.osint",
      label: "OSINT",
      tasks: [
        T("ext.osint.employees", "Employee enum (LinkedIn / hunter.io)", undefined, {
          title: "Employee",
          fields: [
            { key: "name", label: "Name", type: "text" },
            { key: "email", label: "Email", type: "text" },
            { key: "role", label: "Role", type: "text" },
          ],
        }),
        T("ext.osint.creds", "Leaked credentials (HIBP / breach DBs)", undefined, {
          title: "Leaked credential",
          fields: [
            { key: "email", label: "Email", type: "text" },
            { key: "source", label: "Breach source", type: "text" },
            { key: "pass", label: "Password (if available)", type: "text" },
          ],
        }),
        T("ext.osint.tech", "Tech stack from job postings"),
        T("ext.osint.github", "GitHub org secrets / leaks"),
        T("ext.osint.shodan", "Shodan / Censys / FOFA recon", "Search for org's exposed assets by ASN, org name, SSL cert.", {
          title: "Shodan hit",
          fields: [
            { key: "query", label: "Query used", type: "text" },
            { key: "host", label: "Host / IP", type: "text" },
            { key: "finding", label: "Interesting finding", type: "longtext" },
          ],
        }),
      ],
    },
    {
      key: "ext.assets",
      label: "Asset Discovery",
      tasks: [
        T("ext.assets.subdomains", "Subdomain enum (passive + active)", undefined, {
          title: "Subdomain",
          fields: [
            { key: "subdomain", label: "Subdomain", type: "text" },
            { key: "ip", label: "IP", type: "text" },
            { key: "status", label: "HTTP status / port", type: "text" },
          ],
        }),
        T("ext.assets.ctlogs", "Certificate transparency"),
        T("ext.assets.rdns", "Reverse DNS sweep"),
        T("ext.assets.asn", "ASN-based IP discovery"),
      ],
    },
    {
      key: "ext.services",
      label: "Service Exposure",
      tasks: [
        T("ext.services.nmap", "External nmap"),
        T("ext.services.webapps", "Web app inventory", undefined, {
          title: "Public web app",
          fields: [
            { key: "url", label: "URL", type: "text" },
            { key: "server", label: "Server header", type: "text" },
            { key: "app", label: "App / framework", type: "text" },
          ],
        }),
        T("ext.services.admin", "Exposed admin panels"),
        T("ext.services.devstaging", "Exposed dev / staging"),
        T("ext.services.ssl_tls", "SSL/TLS audit (testssl.sh / sslyze)", "Check for weak ciphers, expired/self-signed certs, legacy protocols.", {
          title: "TLS issue",
          fields: [
            { key: "host", label: "Host", type: "text" },
            { key: "issue", label: "Issue found", type: "text" },
            { key: "protocol", label: "Protocol / cipher", type: "text" },
          ],
        }),
        T("ext.services.portal", "Exposed auth portals (VPN / OWA / Citrix / RD Web)", "Inventory any externally reachable login pages.", {
          title: "Portal",
          fields: [
            { key: "url", label: "URL", type: "text" },
            { key: "type", label: "Type (VPN / OWA / ...)", type: "text" },
            { key: "mfa", label: "MFA enforced?", type: "checkbox" },
          ],
        }),
      ],
    },
    {
      key: "ext.email",
      label: "Email",
      tasks: [
        T("ext.email.spfdmarc", "SPF / DMARC / DKIM gap"),
        T("ext.email.relay", "Open mail relay"),
        T("ext.email.userenum", "Mail server user enum (VRFY / RCPT)"),
      ],
    },
    {
      key: "ext.access",
      label: "Initial Access Candidates",
      tasks: [
        T("ext.access.nday", "n-day on exposed app", undefined, {
          title: "n-day candidate",
          fields: [
            { key: "cve", label: "CVE", type: "text" },
            { key: "target", label: "Target", type: "text" },
            { key: "status", label: "Status", type: "select", options: ["untested", "vulnerable", "exploited", "patched"] },
          ],
        }),
        T("ext.access.vpn_rdp", "Exposed VPN / RDP"),
        T("ext.access.reuse", "Credential reuse → OWA/M365", undefined, {
          title: "Credential reuse hit",
          fields: [
            { key: "user", label: "User", type: "text" },
            { key: "source", label: "Source of pass", type: "text" },
          ],
        }),
      ],
    },
  ],
};

const internalCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "int.discovery",
      label: "Discovery",
      tasks: [
        T("int.discovery.nmap", "Internal nmap by subnet", undefined, {
          title: "Subnet scan",
          fields: [
            { key: "subnet", label: "Subnet", type: "text" },
            { key: "count", label: "Live hosts", type: "number" },
          ],
        }),
        T("int.discovery.adidns", "ADIDNS / mDNS enum"),
        T("int.discovery.smb_shares", "SMB share enum", undefined, {
          title: "SMB share",
          fields: [
            { key: "host", label: "Host", type: "text" },
            { key: "share", label: "Share", type: "text" },
            { key: "access", label: "Access", type: "select", options: ["READ", "WRITE", "READ+WRITE", "NONE"] },
          ],
        }),
        T("int.discovery.snmp", "SNMP community strings"),
      ],
    },
    {
      key: "int.poison",
      label: "Network Poisoning",
      tasks: [
        T("int.poison.llmnr", "LLMNR / NBT-NS (Responder)", undefined, {
          title: "Captured hash",
          fields: [
            { key: "src_ip", label: "Source IP", type: "text" },
            { key: "hash_type", label: "Type", type: "select", options: ["NTLMv1", "NTLMv2", "NetNTLMv1", "NetNTLMv2"] },
            { key: "user", label: "User", type: "text" },
          ],
        }),
        T("int.poison.mitm6", "mitm6 (IPv6 DHCPv6)"),
        T("int.poison.arp", "ARP / DNS spoof (rare)"),
      ],
    },
    {
      key: "int.coerce",
      label: "Coerce Attacks",
      tasks: [
        T("int.coerce.petitpotam", "PetitPotam (EfsRpcOpenFileRaw)", "Triggers machine auth from target DC/server.", {
          title: "PetitPotam coerce",
          fields: [
            { key: "target", label: "Target host", type: "text" },
            { key: "listener", label: "Responder / relay listener", type: "text" },
            { key: "captured", label: "Hash / session captured?", type: "checkbox" },
          ],
        }),
        T("int.coerce.printerbug", "PrinterBug (SpoolSS)", "SpoolSS RPC triggers auth from print spooler service."),
        T("int.coerce.dfscerce", "DFSCoerce (NetrDfsRemoveStaleEntries)"),
        T("int.coerce.shadowcoerce", "ShadowCoerce"),
        T("int.coerce.drop_the_mic", "Drop the MIC / CVE-2019-1040"),
      ],
    },
    {
      key: "int.relay",
      label: "Relay Attacks",
      tasks: [
        T("int.relay.smb", "NTLM relay to SMB", undefined, {
          title: "SMB relay",
          fields: [
            { key: "source", label: "Source host", type: "text" },
            { key: "target", label: "Target host", type: "text" },
            { key: "success", label: "Got session?", type: "checkbox" },
          ],
        }),
        T("int.relay.ldap", "Relay to LDAP / LDAPS"),
        T("int.relay.adcs", "Relay to ADCS (ESC8)"),
        T("int.relay.mssql", "Relay to MSSQL"),
        T("int.relay.signing", "SMB signing review"),
      ],
    },
    {
      key: "int.creds",
      label: "Credential Capture & Crack",
      tasks: [
        T("int.creds.captured", "Captured net-NTLMv2 feed"),
        T("int.creds.hashcat", "Hashcat crack", undefined, {
          title: "Crack run",
          fields: [
            { key: "file", label: "Hash file", type: "text" },
            { key: "count", label: "Cracked count", type: "number" },
          ],
        }),
        T("int.creds.spray", "Password spray (mind lockout)"),
      ],
    },
    {
      key: "int.dpapi",
      label: "DPAPI & Legacy Misconfigs",
      tasks: [
        T("int.dpapi.masterkeys", "DPAPI master key extraction", "mimikatz sekurlsa::dpapi or dpapi.py.", {
          title: "DPAPI secrets",
          fields: [
            { key: "host", label: "Host", type: "text" },
            { key: "secrets", label: "Secrets found", type: "longtext" },
          ],
        }),
        T("int.dpapi.browser", "Browser credential extraction (DPAPI)"),
        T("int.gpp.cpassword", "GPP cpassword in SYSVOL", "Look for cpassword in Groups.xml / Services.xml etc.", {
          title: "GPP cpassword",
          fields: [
            { key: "file", label: "GPP file path", type: "text" },
            { key: "user", label: "Username", type: "text" },
            { key: "decrypted", label: "Decrypted password", type: "text" },
          ],
        }),
        T("int.service_acct", "Service account hunting (SPN hunting)", "Find service accounts with weak passwords via Kerberoast."),
      ],
    },
    {
      key: "int.vulns",
      label: "Vulnerability Scanning",
      tasks: [
        T("int.vulns.eol", "MS-EOL / unpatched systems"),
        T("int.vulns.smb1", "SMBv1 enabled"),
        T("int.vulns.smb_vuln", "smb-vuln-* nmap scripts"),
        T("int.vulns.legacy", "Legacy services (telnet/ftp/finger)"),
      ],
    },
    {
      key: "int.lateral",
      label: "Lateral Movement",
      tasks: [
        T("int.lateral.ssh", "SSH key reuse on Linux"),
        T("int.lateral.zerologon", "Zerologon / nopac (if applicable)"),
        T("int.lateral.see_ad", "(See AD playbook for Windows lateral)"),
      ],
    },
    {
      key: "int.privesc",
      label: "Local Privilege Escalation",
      tasks: [
        T("int.privesc.win", "Windows (WinPEAS / Seatbelt)", undefined, {
          title: "Windows privesc",
          fields: [
            { key: "host", label: "Host", type: "text" },
            { key: "vector", label: "Vector / CVE", type: "text" },
          ],
        }),
        T("int.privesc.linux", "Linux (LinPEAS / sudo / kernel)"),
        T("int.privesc.macos", "macOS"),
      ],
    },
  ],
};

const wirelessCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "wifi.recon",
      label: "Recon",
      tasks: [
        T("wifi.recon.airodump", "Airodump scan", undefined, {
          title: "AP observed",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "bssid", label: "BSSID", type: "text" },
            { key: "ch", label: "Channel", type: "number" },
            { key: "crypto", label: "Crypto", type: "select", options: ["Open", "WEP", "WPA2-PSK", "WPA3-PSK", "WPA-EAP", "WPA2-EAP", "WPA3-EAP"] },
            { key: "signal", label: "Signal (dBm)", type: "text" },
          ],
        }),
        T("wifi.recon.kismet", "Kismet survey"),
        T("wifi.recon.wigle", "Wigle lookup"),
        T("wifi.recon.hidden", "Hidden SSID discovery via probes"),
      ],
    },
    {
      key: "wifi.wpa2",
      label: "WPA2-PSK",
      tasks: [
        T("wifi.wpa2.handshake", "Handshake capture", undefined, {
          title: "Handshake",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "file", label: "Capture file", type: "text" },
            { key: "status", label: "Status", type: "select", options: ["captured", "partial", "failed"] },
          ],
        }),
        T("wifi.wpa2.pmkid", "PMKID capture", undefined, {
          title: "PMKID",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "hash", label: "Hash", type: "longtext" },
          ],
        }),
        T("wifi.wpa2.crack", "Hashcat / aircrack PSK", undefined, {
          title: "Cracked PSK",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "psk", label: "PSK", type: "text" },
          ],
        }),
      ],
    },
    {
      key: "wifi.wps",
      label: "WPS Attacks",
      tasks: [
        T("wifi.wps.pixiedust", "Pixie-Dust attack", "Works on routers with weak RNG (reaver --pixie-dust).", {
          title: "Pixie-Dust result",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "bssid", label: "BSSID", type: "text" },
            { key: "psk", label: "Recovered PSK", type: "text" },
            { key: "pin", label: "WPS PIN", type: "text" },
          ],
        }),
        T("wifi.wps.bruteforce", "WPS PIN brute force (Reaver)", undefined, {
          title: "WPS brute",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "bssid", label: "BSSID", type: "text" },
            { key: "progress", label: "Progress / result", type: "text" },
          ],
        }),
        T("wifi.wps.pmkid_clientless", "PMKID clientless attack (hcxdumptool)", "No client required — capture PMKID beacon.", {
          title: "PMKID clientless",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "pmkid", label: "PMKID", type: "longtext" },
            { key: "cracked", label: "Cracked PSK", type: "text" },
          ],
        }),
      ],
    },
    {
      key: "wifi.wpa3",
      label: "WPA3",
      tasks: [
        T("wifi.wpa3.downgrade", "Downgrade test"),
        T("wifi.wpa3.dragonblood", "Dragonblood probes"),
      ],
    },
    {
      key: "wifi.enterprise",
      label: "WPA-Enterprise",
      tasks: [
        T("wifi.ent.rogue_radius", "Rogue RADIUS (eaphammer)", undefined, {
          title: "Rogue RADIUS capture",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "user", label: "User", type: "text" },
            { key: "challenge", label: "Challenge / response", type: "longtext" },
          ],
        }),
        T("wifi.ent.eapmd5", "EAP-MD5 crack"),
        T("wifi.ent.cert_validate", "Cert validation absent (silent connect)"),
      ],
    },
    {
      key: "wifi.open",
      label: "Open / Captive",
      tasks: [
        T("wifi.open.discovery", "Open AP discovery"),
        T("wifi.open.captive_bypass", "Captive portal bypass"),
        T("wifi.open.macacl", "MAC ACL bypass"),
      ],
    },
    {
      key: "wifi.eviltwin",
      label: "Evil Twin",
      tasks: [
        T("wifi.eviltwin.rogue_ap", "Rogue AP w/ same SSID", undefined, {
          title: "Evil twin run",
          fields: [
            { key: "ssid", label: "SSID", type: "text" },
            { key: "ch", label: "Channel", type: "number" },
            { key: "clients", label: "Connected clients (count)", type: "number" },
          ],
        }),
        T("wifi.eviltwin.karma", "KARMA probes"),
        T("wifi.eviltwin.deauth", "Deauth + reauth"),
      ],
    },
    {
      key: "wifi.client",
      label: "Client Attacks",
      tasks: [
        T("wifi.client.geo", "Probe-based geolocation"),
        T("wifi.client.portal_phish", "Captive portal phishing"),
      ],
    },
  ],
};

const cloudCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "cloud.setup",
      label: "Provider Setup",
      tasks: [
        T("cloud.setup.identify", "Identify provider + account", undefined, {
          title: "Provider context",
          fields: [
            { key: "provider", label: "Provider", type: "select", options: ["AWS", "Azure", "GCP", "OCI", "Other"] },
            { key: "account", label: "Account ID / Tenant", type: "text" },
            { key: "role", label: "Role / principal used", type: "text" },
          ],
        }),
        T("cloud.setup.iam_baseline", "Baseline IAM enum"),
      ],
    },
    {
      key: "cloud.iam",
      label: "IAM",
      tasks: [
        T("cloud.iam.aws", "AWS: users/roles/policies (Pacu, aws-iam-cli)", undefined, {
          title: "Interesting IAM perm",
          fields: [
            { key: "principal", label: "Principal", type: "text" },
            { key: "scope", label: "Scope (resource)", type: "text" },
            { key: "perms", label: "Permissions", type: "longtext" },
          ],
        }),
        T("cloud.iam.azure", "Azure: Entra ID (AADInternals, ROADtools)"),
        T("cloud.iam.gcp", "GCP: gcloud asset inventory"),
      ],
    },
    {
      key: "cloud.storage",
      label: "Public Storage",
      tasks: [
        T("cloud.storage.s3", "S3 public buckets", undefined, {
          title: "Bucket",
          fields: [
            { key: "bucket", label: "Bucket name", type: "text" },
            { key: "access", label: "Access", type: "select", options: ["read", "write", "read+write"] },
            { key: "sensitive", label: "Sensitive content?", type: "checkbox" },
          ],
        }),
        T("cloud.storage.azure_blob", "Azure Blobs"),
        T("cloud.storage.gcs", "GCS buckets"),
      ],
    },
    {
      key: "cloud.compute",
      label: "Compute / Metadata",
      tasks: [
        T("cloud.compute.ec2_imds", "EC2 IMDSv1 SSRF", undefined, {
          title: "Metadata extraction",
          fields: [
            { key: "instance", label: "Instance ID", type: "text" },
            { key: "creds", label: "Creds extracted (role)", type: "text" },
          ],
        }),
        T("cloud.compute.azure_imds", "Azure VM IMDS"),
        T("cloud.compute.gce_meta", "GCE metadata"),
      ],
    },
    {
      key: "cloud.secrets",
      label: "Secrets",
      tasks: [
        T("cloud.secrets.aws_sm", "Secrets Manager / SSM"),
        T("cloud.secrets.azure_kv", "Key Vault"),
        T("cloud.secrets.gcp_sm", "GCP Secret Manager"),
        T("cloud.secrets.lambda_env", "Env vars in Lambda / Function"),
        T("cloud.secrets.pipelines", "Build pipeline secrets"),
      ],
    },
    {
      key: "cloud.privesc",
      label: "Privilege Escalation",
      tasks: [
        T("cloud.privesc.passrole", "iam:PassRole + service abuse"),
        T("cloud.privesc.assumerole", "AssumeRole chains"),
        T("cloud.privesc.azure_app", "Azure subscription owner via app reg"),
        T("cloud.privesc.gcp_bindings", "GCP IAM bindings escalation"),
      ],
    },
    {
      key: "cloud.persist",
      label: "Persistence",
      tasks: [
        T("cloud.persist.new_iam", "New IAM user / access key"),
        T("cloud.persist.ssh_ec2", "SSH key on EC2"),
        T("cloud.persist.lambda", "Backdoored Lambda"),
        T("cloud.persist.oauth_consent", "OAuth app consent (Entra)"),
      ],
    },
  ],
};

const socialCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "soc.recon",
      label: "Recon",
      tasks: [
        T("soc.recon.employees", "Employee enum", undefined, {
          title: "Target",
          fields: [
            { key: "name", label: "Name", type: "text" },
            { key: "email", label: "Email", type: "text" },
            { key: "role", label: "Role", type: "text" },
            { key: "source", label: "Source", type: "text" },
          ],
        }),
        T("soc.recon.orgchart", "Org chart"),
        T("soc.recon.tech", "Tech stack (M365 / GSuite)"),
        T("soc.recon.comms", "Communication patterns"),
      ],
    },
    {
      key: "soc.pretext",
      label: "Pretext Development",
      tasks: [
        T("soc.pretext.doc", "Pretext document", undefined, {
          title: "Pretext",
          fields: [
            { key: "name", label: "Pretext name", type: "text" },
            { key: "persona", label: "Persona / sender", type: "text" },
            { key: "urgency", label: "Urgency hook", type: "longtext" },
          ],
        }),
        T("soc.pretext.domain", "Sender domain (look-alike)"),
        T("soc.pretext.landing", "Landing page"),
      ],
    },
    {
      key: "soc.email",
      label: "Email Campaigns",
      tasks: [
        T("soc.email.setup", "Gophish / EvilGinx setup"),
        T("soc.email.targets", "Target list import"),
        T("soc.email.send", "Send & track", undefined, {
          title: "Campaign metrics",
          fields: [
            { key: "campaign", label: "Campaign", type: "text" },
            { key: "sent", label: "Sent", type: "number" },
            { key: "clicked", label: "Clicked", type: "number" },
            { key: "submitted", label: "Credential submitted", type: "number" },
            { key: "mfa_passed", label: "MFA passed", type: "number" },
          ],
        }),
      ],
    },
    {
      key: "soc.mfa",
      label: "MFA Bypass",
      tasks: [
        T("soc.mfa.fatigue", "Push fatigue / MFA bombing"),
        T("soc.mfa.evilginx", "evilginx2 reverse proxy", undefined, {
          title: "Captured session",
          fields: [
            { key: "user", label: "User", type: "text" },
            { key: "cookies", label: "Captured cookies", type: "longtext" },
          ],
        }),
        T("soc.mfa.devicecode", "OAuth device-code phish"),
      ],
    },
    {
      key: "soc.voice",
      label: "Voice / SMS / In-person",
      tasks: [
        T("soc.voice.vish", "Vishing call", undefined, {
          title: "Vishing call",
          fields: [
            { key: "number", label: "Number called", type: "text" },
            { key: "persona", label: "Persona", type: "text" },
            { key: "outcome", label: "Outcome", type: "longtext" },
          ],
        }),
        T("soc.voice.smish", "Smishing"),
        T("soc.voice.usb_drop", "USB drop", undefined, {
          title: "USB drop",
          fields: [
            { key: "location", label: "Location", type: "text" },
            { key: "model", label: "Device model", type: "text" },
            { key: "payload", label: "Payload", type: "text" },
            { key: "beacon", label: "Beacon received?", type: "checkbox" },
          ],
        }),
      ],
    },
    {
      key: "soc.captured",
      label: "Captured",
      tasks: [
        T("soc.captured.cred", "Credential set", undefined, {
          title: "Captured credential",
          fields: [
            { key: "user", label: "User", type: "text" },
            { key: "pass", label: "Password", type: "text" },
            { key: "source", label: "Source campaign", type: "text" },
          ],
        }),
        T("soc.captured.session", "Session token"),
        T("soc.captured.intel", "Sensitive intel gleaned"),
      ],
    },
  ],
};

const physicalCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "phys.recon",
      label: "Recon",
      tasks: [
        T("phys.recon.survey", "Site survey", undefined, {
          title: "Site",
          fields: [
            { key: "address", label: "Address", type: "text" },
            { key: "hours", label: "Hours observed", type: "text" },
            { key: "security", label: "Security observed", type: "longtext" },
          ],
        }),
        T("phys.recon.dumpster", "Dumpster dive"),
        T("phys.recon.badge_id", "Badge type ID (HID Prox / iCLASS / MIFARE)"),
        T("phys.recon.cameras", "Camera placement"),
      ],
    },
    {
      key: "phys.badge_lock",
      label: "Badge & Lock",
      tasks: [
        T("phys.badge.clone", "RFID clone attempt", undefined, {
          title: "Clone attempt",
          fields: [
            { key: "target_badge", label: "Target badge", type: "text" },
            { key: "device", label: "Copy device (Proxmark / Flipper)", type: "text" },
            { key: "success", label: "Success?", type: "checkbox" },
          ],
        }),
        T("phys.lock.pick", "Lock pick attempt", undefined, {
          title: "Lock pick",
          fields: [
            { key: "door", label: "Door", type: "text" },
            { key: "lock", label: "Lock type", type: "text" },
            { key: "time", label: "Time to open", type: "text" },
          ],
        }),
        T("phys.lock.bypass", "Bypass tools (under-door / traveler hook)"),
        T("phys.lock.impression", "Key impressioning"),
      ],
    },
    {
      key: "phys.entry",
      label: "Entry",
      tasks: [
        T("phys.entry.tailgate", "Tailgating", undefined, {
          title: "Tailgate attempt",
          fields: [
            { key: "door", label: "Door", type: "text" },
            { key: "method", label: "Method", type: "longtext" },
            { key: "time", label: "Time of day", type: "text" },
            { key: "outcome", label: "Outcome", type: "select", options: ["entered", "denied", "challenged"] },
          ],
        }),
        T("phys.entry.piggyback", "Piggybacking"),
        T("phys.entry.vendor", "Vendor pretext"),
        T("phys.entry.emergency", "Emergency exit prop"),
      ],
    },
    {
      key: "phys.onsite",
      label: "On-site",
      tasks: [
        T("phys.onsite.camera_evade", "Camera / log evasion notes"),
        T("phys.onsite.dropbox", "Drop box placement", undefined, {
          title: "Drop box",
          fields: [
            { key: "location", label: "Location", type: "text" },
            { key: "device", label: "Device", type: "text" },
            { key: "callback", label: "Callback received at", type: "text" },
          ],
        }),
        T("phys.onsite.usb_drop", "USB drop on-site", undefined, {
          title: "USB drop",
          fields: [
            { key: "location", label: "Location", type: "text" },
            { key: "model", label: "Model", type: "text" },
            { key: "payload", label: "Payload", type: "text" },
          ],
        }),
        T("phys.onsite.printouts", "Sensitive printout grab"),
      ],
    },
    {
      key: "phys.evidence",
      label: "Evidence",
      tasks: [
        T("phys.evidence.photos", "Photo log (timestamped)"),
        T("phys.evidence.custody", "Chain of custody for items"),
        T("phys.evidence.safety", "Safety abort triggers documented"),
      ],
    },
  ],
};

const injectCatalog: PlaybookKindCatalog = {
  categories: [
    {
      key: "inj.triage",
      label: "Triage",
      tasks: [
        T(
          "inj.triage.log",
          "Log new inject (Inbox)",
          "Log every email or in-person ask in the Inbox tab first.",
        ),
        T("inj.triage.classify", "Classify (category + priority)"),
        T("inj.triage.assign", "Assign owner"),
        T("inj.triage.deadline", "Set deadline"),
      ],
    },
    {
      key: "inj.phish_create",
      label: "Phishing email creation",
      tasks: [
        T("inj.phish_create.scope", "Confirm scope / targets", undefined, {
          title: "Phishing scope",
          fields: [
            { key: "audience", label: "Target audience", type: "text" },
            { key: "lure", label: "Lure / theme", type: "text" },
            { key: "pretext", label: "Pretext name", type: "text" },
            { key: "sender", label: "Sender persona", type: "text" },
          ],
        }),
        T("inj.phish_create.draft", "Draft email", undefined, {
          title: "Draft",
          fields: [
            { key: "subject", label: "Subject line", type: "text" },
            { key: "body", label: "Body (markdown)", type: "longtext" },
            { key: "link", label: "Link target", type: "text" },
          ],
        }),
        T("inj.phish_create.landing", "Landing page", undefined, {
          title: "Landing page",
          fields: [
            { key: "url", label: "URL", type: "text" },
            { key: "capture", label: "Capture mechanism", type: "text" },
          ],
        }),
        T("inj.phish_create.send", "Send / handoff", undefined, {
          title: "Send",
          fields: [
            { key: "by", label: "Who sends", type: "text" },
            { key: "ts", label: "Timestamp", type: "text" },
          ],
        }),
      ],
    },
    {
      key: "inj.phish_classify",
      label: "Phishing classification",
      tasks: [
        T("inj.phish_classify.headers", "Header analysis", undefined, {
          title: "Header analysis",
          fields: [
            { key: "from_domain", label: "From domain", type: "text" },
            { key: "spf", label: "SPF", type: "select", options: ["pass", "fail", "softfail", "neutral", "none"] },
            { key: "dkim", label: "DKIM", type: "select", options: ["pass", "fail", "none"] },
            { key: "dmarc", label: "DMARC", type: "select", options: ["pass", "fail", "none"] },
            { key: "received", label: "Received chain", type: "longtext" },
          ],
        }),
        T("inj.phish_classify.urls", "URL inspection", undefined, {
          title: "URL inspection",
          fields: [
            { key: "url", label: "URL", type: "text" },
            { key: "redirects", label: "Redirect chain", type: "longtext" },
            { key: "rep", label: "Reputation (VT / urlscan)", type: "text" },
          ],
        }),
        T("inj.phish_classify.attach", "Attachment analysis", undefined, {
          title: "Attachment analysis",
          fields: [
            { key: "filename", label: "Filename", type: "text" },
            { key: "sha256", label: "SHA-256", type: "text" },
            { key: "sandbox", label: "Sandbox result", type: "longtext" },
          ],
        }),
        T("inj.phish_classify.verdict", "Verdict + rationale", undefined, {
          title: "Verdict",
          fields: [
            { key: "verdict", label: "Verdict", type: "select", options: ["phishing", "legit", "suspicious", "inconclusive"] },
            { key: "evidence", label: "Evidence summary", type: "longtext" },
          ],
        }),
      ],
    },
    {
      key: "inj.network_q",
      label: "Network question",
      tasks: [
        T("inj.network_q.locate", "Locate referenced asset / user / service"),
        T("inj.network_q.compose", "Compose answer", undefined, {
          title: "Answer draft",
          fields: [
            { key: "response", label: "Response (markdown)", type: "longtext" },
            { key: "evidence", label: "Cited evidence", type: "longtext" },
          ],
        }),
        T("inj.network_q.review", "Review with team lead"),
      ],
    },
    {
      key: "inj.in_person",
      label: "In-person question",
      tasks: [
        T("inj.in_person.capture", "Capture question (Inbox)", undefined, {
          title: "In-person question",
          fields: [
            { key: "requester", label: "Requester", type: "text" },
            { key: "ts", label: "Timestamp", type: "text" },
            { key: "question", label: "Paraphrased question", type: "longtext" },
          ],
        }),
        T("inj.in_person.respond", "Respond on the spot or defer"),
        T("inj.in_person.outcome", "Record outcome", undefined, {
          title: "Outcome",
          fields: [
            { key: "answer", label: "Answer", type: "longtext" },
            { key: "followup", label: "Follow-up needed?", type: "checkbox" },
          ],
        }),
      ],
    },
    {
      key: "inj.close",
      label: "Response & close",
      tasks: [
        T("inj.close.send", "Send response", undefined, {
          title: "Sent",
          fields: [
            { key: "channel", label: "Channel", type: "text" },
            { key: "ts", label: "Timestamp", type: "text" },
          ],
        }),
        T("inj.close.ack", "Confirm receipt", undefined, {
          title: "Ack",
          fields: [
            { key: "received", label: "Acknowledged?", type: "checkbox" },
            { key: "ts", label: "Ack time", type: "text" },
          ],
        }),
        T("inj.close.archive", "Archive with verdict / status"),
        T("inj.close.retro", "Retro note (consider adding to Library)"),
      ],
    },
  ],
};

export const PLAYBOOKS: Record<WorkstreamKind, PlaybookKindCatalog | null> = {
  active_directory: adCatalog,
  web: webCatalog,
  external: externalCatalog,
  internal: internalCatalog,
  wireless: wirelessCatalog,
  cloud: cloudCatalog,
  social: socialCatalog,
  physical: physicalCatalog,
  inject: injectCatalog,
  other: null,
};
