apt-get update && \
apt-get -y install curl python-software-properties && \
curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
apt-get install -y nodejs