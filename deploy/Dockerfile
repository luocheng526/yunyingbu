# 应用 Dockerfile 模板 — 根据实际技术栈修改
FROM alpine:3.20
WORKDIR /app
COPY . .
RUN printf '%s\n' 'yunyingbu placeholder — 请替换为实际应用' > /app/index.html
EXPOSE 8080
CMD ["httpd", "-f", "-p", "8080", "-h", "/app"]
