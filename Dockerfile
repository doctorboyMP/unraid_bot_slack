FROM phusion/baseimage:0.10.1

# Maintainer of the container
LABEL maintainer="doctorboy"

# Set the working directory to /app
WORKDIR /app

# Copy the app directory contents into the container at /app
ADD app/ /app/

# Copy the build directory contents into the container at /tmp
ADD build/ /tmp/

# Copy the startup directory contents into the container at /app
ADD startup/*.sh /app/

# Install any needed packages specified in requirements.txt
RUN \
    echo "**** install dependencies and packages ****" && \
    sh /tmp/build.sh && \
    node -v && \
    echo "**** config nodejs and respective packages ****" && \
    npm -v && \
    npm i --package-lock-only && \
    npm audit fix && \
    npm install && \
    npm install -g botkit && \
    npm install fs request && \
    echo "**** clean up task ****" && \
    rm -rf \
	    /tmp/


# Make variable port available to the world outside this container
EXPOSE 8765

# Define volume mapping
VOLUME /config

# Run app.py when the container launches
CMD sh start.sh ${CLIENT_ID} ${CLIENT_SECRET} ${GRAFANA_USER} ${GRAFANA_PASS} ${GRAFANA_HTTP}