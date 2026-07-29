# Discover a printer

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** the adapters repo (`adapters`), the daemon repo (`daemon`).

**As a** Bespok3d user, **I want** the app to find my printer automatically on the local network, **so that** I don't have to type an IP address or SSH into the machine.

## Acceptance criteria

- [ ] App scans for mDNS/Bonjour records advertising the Bespok3d daemon service on the local network - 🔲 currently scans `_moonraker._tcp`; `_bespok3d._tcp` requires daemon
- [x] Each discovered printer appears in the sidebar with its hostname and model (from adapter metadata)
- [x] If no printer is found, the app shows an empty state with guidance ("Make sure the printer is on and the Bespok3d base layer is installed")
- [x] Discovery is continuous - a printer that comes online after the app opens appears without a manual refresh
- [x] A printer that goes offline is greyed out but not removed from the list

## Flags

> 🔲 **UNKNOWN** - `_bespok3d._tcp` mDNS advertisement is not yet implemented. The daemon runs but does not advertise itself over mDNS. Discovery currently uses `_moonraker._tcp` scan to find Klipper printers and then determines managed status via TCP probe to port 4269.

> ❓ **UNCLEAR** - What happens when the same printer appears on two network interfaces (wired + Wi-Fi)? Should duplicates be merged or shown separately?

> **Resolved** - "Managed" means the bespok3d daemon is running and responding on port 4269. `online` means the printer is reachable (port 80) but the daemon is not running. The app checks daemon status via TCP connect on every ping cycle for enrolled printers.
