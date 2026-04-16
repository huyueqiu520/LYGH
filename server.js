const WebSocket = require('ws');

// 配置
const PORT = process.env.PORT || 8765;
const HOST = process.env.HOST || '0.0.0.0';

// WebSocket服务器
const wss = new WebSocket.Server({ 
    host: HOST,
    port: PORT,
    heartbeatInterval: 30000 // 30秒心跳
});

// 客户端管理
const servers = new Map(); // 存储所有Windows服务器客户端
const clients = new Map(); // 存储所有Android客户端

// 心跳检测
function heartbeat() {
    this.isAlive = true;
}

// 心跳定时器
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

wss.on('connection', (ws, req) => {
    // 获取客户端IP
    const ip = req.socket.remoteAddress;
    console.log(`[连接] 新客户端连接: ${ip}`);
    
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    
    // 发送欢迎消息
    ws.send(JSON.stringify({
        type: 'connected',
        message: '已连接到中转服务器',
        timestamp: new Date().toISOString()
    }));
    
    // 处理消息
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(ws, message);
        } catch (error) {
            console.error('[错误] 无法解析消息:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: '消息格式错误',
                error: error.message
            }));
        }
    });
    
    // 处理连接关闭
    ws.on('close', () => {
        console.log('[断开] 客户端断开连接:', ip);
        
        // 从对应列表中移除
        servers.delete(ws);
        clients.delete(ws);
        
        // 通知其他客户端
        broadcastToClients({
            type: 'status',
            message: 'Windows监控器已断开',
            timestamp: new Date().toISOString()
        });
    });
    
    // 处理错误
    ws.on('error', (error) => {
        console.error('[错误] WebSocket错误:', error);
    });
});

// 处理客户端消息
function handleMessage(ws, message) {
    console.log(`[消息] 收到消息: ${message.type}`);
    
    switch (message.type) {
        case 'register':
            // 客户端注册
            handleRegister(ws, message);
            break;
            
        case 'broadcast':
            // 广播消息（从Windows到Android）
            handleBroadcast(ws, message);
            break;
            
        case 'ping':
            // 心跳响应
            ws.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString()
            }));
            break;
            
        case 'request_status':
            // 请求状态
            handleRequestStatus(ws);
            break;
            
        default:
            console.log('[警告] 未知消息类型:', message.type);
    }
}

// 处理注册
function handleRegister(ws, message) {
    const clientType = message.clientType; // 'server' 或 'client'
    const clientId = message.clientId || generateId();
    
    if (clientType === 'server') {
        servers.set(ws, {
            id: clientId,
            connectTime: new Date().toISOString(),
            lastActive: new Date().toISOString()
        });
        console.log(`[注册] Windows监控器注册: ${clientId}`);
        
        ws.send(JSON.stringify({
            type: 'registered',
            clientId: clientId,
            role: 'server',
            message: '注册成功，可以开始广播消息',
            timestamp: new Date().toISOString()
        }));
        
    } else if (clientType === 'client') {
        clients.set(ws, {
            id: clientId,
            connectTime: new Date().toISOString(),
            lastActive: new Date().toISOString()
        });
        console.log(`[注册] Android客户端注册: ${clientId}`);
        
        ws.send(JSON.stringify({
            type: 'registered',
            clientId: clientId,
            role: 'client',
            message: '注册成功，等待接收消息',
            timestamp: new Date().toISOString()
        }));
        
        // 如果有活跃的Windows服务器，通知Android客户端
        if (servers.size > 0) {
            ws.send(JSON.stringify({
                type: 'status',
                message: `Windows监控器在线 (${servers.size}个)`,
                timestamp: new Date().toISOString()
            }));
        }
    }
}

// 处理广播
function handleBroadcast(ws, message) {
    if (!servers.has(ws)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '未注册的服务器'
        }));
        return;
    }
    
    console.log(`[广播] 转发消息到 ${clients.size} 个Android客户端`);
    
    // 转发消息到所有Android客户端
    const broadcastMessage = {
        ...message,
        serverId: servers.get(ws).id,
        relayTimestamp: new Date().toISOString()
    };
    
    broadcastToClients(broadcastMessage);
}

// 广播消息到所有Android客户端
function broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    
    clients.forEach((clientInfo, clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            try {
                clientWs.send(messageStr);
            } catch (error) {
                console.error('[错误] 发送消息失败:', error);
            }
        }
    });
}

// 处理状态请求
function handleRequestStatus(ws) {
    ws.send(JSON.stringify({
        type: 'status_info',
        servers: servers.size,
        clients: clients.size,
        timestamp: new Date().toISOString()
    }));
}

// 生成随机ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// 服务器启动信息
wss.on('listening', () => {
    console.log('====================================');
    console.log('Ngrok监控 - WebSocket中转服务器');
    console.log('====================================');
    console.log(`服务器地址: ws://${HOST}:${PORT}`);
    console.log(`Windows监控器连接: ws://YOUR_SERVER_IP:${PORT}`);
    console.log(`Android客户端连接: ws://YOUR_SERVER_IP:${PORT}`);
    console.log('====================================');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n[关闭] 正在关闭服务器...');
    wss.close(() => {
        console.log('[关闭] 服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n[关闭] 收到终止信号...');
    wss.close(() => {
        console.log('[关闭] 服务器已关闭');
        process.exit(0);
    });
});