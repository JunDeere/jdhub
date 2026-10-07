FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_BASE=
ENV VITE_API_BASE=$VITE_API_BASE
ARG VITE_ALLOW_REGISTRATION=false
ENV VITE_ALLOW_REGISTRATION=$VITE_ALLOW_REGISTRATION
ARG VITE_PORTFOLIO_BRIDGE_ENABLED=false
ENV VITE_PORTFOLIO_BRIDGE_ENABLED=$VITE_PORTFOLIO_BRIDGE_ENABLED
ARG VITE_PORTFOLIO_PARENT_ORIGIN=
ENV VITE_PORTFOLIO_PARENT_ORIGIN=$VITE_PORTFOLIO_PARENT_ORIGIN
# This image is a production build; the independent dev-server flag is not forwarded.
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
