# Generic fake-printer base for in-vitro tests. It is device-AGNOSTIC: an sshd + python box that also
# carries the bespok3d daemon RUNTIME (a venv with the daemon's deps + openssl), so the in-vitro suite
# can run the REAL daemon in-container and reach it with the app's real client. Each adapter's
# testkit/fixture.json parameterizes the firmware skeleton at run time, so one image serves every
# adapter. NOT a real printer: no overlayfs / rcS / wifi / compositor; the logical-coherence substrate.
# Bookworm ships Python 3.11, the bespok3d daemon target. The architecture is pinned to the printer's
# (aarch64) because the daemon package carries the printer's own compiled wheels: an image on another
# architecture could not install them, and the offline install is the thing under test.
FROM --platform=linux/arm64 debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server python3 python3-venv openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/sshd \
    && sed -i 's/#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config \
    && echo 'root:test-root' | chpasswd \
    && useradd -m lava

# No daemon runtime is baked here. The suite installs it from the daemon's own signed package, offline,
# out of the wheels that package carries, which is how a printer gets it. An image that pulled the deps
# from the network would hide a missing or wrong wheel until it reached a real printer.

EXPOSE 22 4269
CMD ["/usr/sbin/sshd", "-D", "-e"]
