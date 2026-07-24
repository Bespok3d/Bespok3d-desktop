# Generic fake-printer base for in-vitro tests. It is device-AGNOSTIC: an sshd + python box that also
# carries the bespok3d daemon RUNTIME (a venv with the daemon's deps + openssl), so the in-vitro suite
# can run the REAL daemon in-container and reach it with the app's real client. Each adapter's
# testkit/fixture.json parameterizes the firmware skeleton at run time, so one image serves every
# adapter. NOT a real printer: no overlayfs / rcS / wifi / compositor; the logical-coherence substrate.
# Bookworm ships Python 3.11, the bespok3d daemon target.
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server python3 python3-venv openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/sshd \
    && sed -i 's/#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config \
    && echo 'root:test-root' | chpasswd \
    && useradd -m lava

# Bake the daemon runtime so the real daemon can start in-vitro (deps match the sibling daemon/requirements.txt).
RUN python3 -m venv /opt/bespok3d-venv \
    && /opt/bespok3d-venv/bin/pip install --no-cache-dir \
       'fastapi>=0.115' 'uvicorn[standard]>=0.32' 'httpx>=0.27' 'cryptography>=42.0' \
       'pgpy>=0.6.0' 'python-multipart>=0.0.9'

EXPOSE 22 4269
CMD ["/usr/sbin/sshd", "-D", "-e"]
