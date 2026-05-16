# BDApps / mChoice TAP SDK Simulator (sdk-standalone-1.2.68)
# Build from repository root:
#   docker build -f docker/bdapps-simulator/Dockerfile -t bdapps-tap-simulator .

FROM eclipse-temurin:8-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl unzip zip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/tap-sdk

COPY Developer_Bundle/sdk-standalone-1.2.68/ ./
COPY docker/bdapps-simulator/entrypoint.sh /entrypoint.sh

# tap-simulator prefers wrapper-linux-x86-32 when executable; Jammy amd64 image has no 32-bit glibc.
RUN chmod -x bin/wrapper-linux-x86-32 2>/dev/null || true

RUN chmod +x /entrypoint.sh \
  && chmod +x bin/tap-simulator bin/wrapper-linux-x86-64 2>/dev/null || true

EXPOSE 10001 7000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["console"]
