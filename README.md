# WebSocket中转服务器部署说明

## 功能说明

这个中转服务器允许Windows监控器和Android客户端通过云端进行通信，不再受局域网限制。

## 部署方式

### 方式1：部署到自己的云服务器

1. **准备云服务器**
   - 阿里云、腾讯云、华为云等都可以
   - 推荐配置：1核2G内存即可
   - 操作系统：Ubuntu 20.04+ 或 CentOS 7+

2. **安装Node.js**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # CentOS/RHEL
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   ```

3. **上传服务器代码**
   ```bash
   # 在本地打包
   cd cloud-relay
   tar -czf relay-server.tar.gz .

   # 上传到服务器（替换YOUR_SERVER_IP和USERNAME）
   scp relay-server.tar.gz username@YOUR_SERVER_IP:/home/username/

   # 在服务器上解压
   ssh username@YOUR_SERVER_IP
   cd /home/username
   tar -xzf relay-server.tar.gz
   cd relay-server
   ```

4. **安装依赖**
   ```bash
   npm install
   ```

5. **启动服务器**
   ```bash
   # 直接启动
   npm start

   # 或使用PM2后台运行（推荐）
   npm install -g pm2
   pm2 start server.js --name ngrok-relay
   pm2 save
   pm2 startup
   ```

6. **配置防火墙**
   ```bash
   # Ubuntu/Debian (ufw)
   sudo ufw allow 8765/tcp

   # CentOS/RHEL (firewalld)
   sudo firewall-cmd --permanent --add-port=8765/tcp
   sudo firewall-cmd --reload
   ```

7. **获取服务器IP**
   ```bash
   curl ifconfig.me
   ```

### 方式2：使用Docker部署

```bash
# 构建镜像
docker build -t ngrok-relay .

# 运行容器
docker run -d -p 8765:8765 --name ngrok-relay ngrok-relay

# 查看日志
docker logs -f ngrok-relay
```

### 方式3：使用免费云服务（推荐新手）

#### 使用Vercel
1. 注册Vercel账号：https://vercel.com
2. 使用Vercel CLI部署
   ```bash
   npm install -g vercel
   vercel deploy
   ```

#### 使用Railway
1. 注册Railway账号：https://railway.app
2. 点击"New Project" → "Deploy from GitHub repo"
3. 上传代码到GitHub，然后在Railway中选择

#### 使用Render
1. 注册Render账号：https://render.com
2. 创建新的Web Service
3. 连接GitHub仓库
4. 配置构建命令：`npm install`
5. 配置启动命令：`node server.js`

## 配置客户端

### Windows端配置

编辑 `windows-monitor/config.json`：

```json
{
  "use_cloud_relay": true,
  "cloud_relay_url": "ws://YOUR_SERVER_IP:8765",
  "ngrok_api_url": "http://127.0.0.1:4040/api/tunnels",
  "check_interval": 5,
  "log_level": "INFO"
}
```

### Android端配置

在Android应用中输入服务器地址：
```
ws://YOUR_SERVER_IP:8765
```

## 测试连接

1. 启动中转服务器
2. 启动Windows监控器
3. 启动Android应用并连接
4. 如果ngrok地址变化，应该能在Android端收到通知

## 服务器监控

如果使用PM2：
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs ngrok-relay

# 重启服务
pm2 restart ngrok-relay

# 停止服务
pm2 stop ngrok-relay
```

## 故障排除

### 连接失败
- 检查防火墙是否开放8765端口
- 检查服务器是否正常运行
- 检查服务器IP地址是否正确

### 无法接收消息
- 检查Windows监控器是否成功注册
- 检查Android客户端是否成功注册
- 查看服务器日志确认消息转发

### 性能问题
- 增加服务器配置
- 使用Nginx作为反向代理
- 考虑使用负载均衡

## 安全建议

1. **使用HTTPS/WSS**
   - 配置SSL证书
   - 使用Let's Encrypt免费证书

2. **添加认证**
   - 实现token认证
   - 限制连接数量

3. **限流保护**
   - 防止DDoS攻击
   - 限制消息频率

4. **定期更新**
   - 更新Node.js版本
   - 更新依赖包

## 成本估算

- 免费方案：Vercel/Railway/Render的免费套餐
- 低成本方案：1核2G云服务器（约¥30/月）
- 高可用方案：多实例+负载均衡（约¥100+/月）

## 支持

如有问题，请检查：
1. 服务器日志
2. 客户端日志
3. 网络连接状态