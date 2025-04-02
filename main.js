// cd web_prompt_editor
// npm install
// npm install docx
// npm start
// ios: npm run package
// win: npm run package:win
// 修改/新增字段: 修改 chat.js 的 updateUI 函数，增加对新增字段的处理。
// #TODO: 加入prompt engineering专用LLM，帮助老师根据提示直接生成提示词，以消除流程设计的门槛。

// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const redis = require('redis');
const fs = require('fs');

let mainWindow;
let client; // Redis 客户端

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1350,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false, // 允许在渲染进程中使用 Node API
        },
        icon: path.join(__dirname, 'icons', 'app_icon.png')
    });

    // 添加开发者工具快捷键
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setVisualZoomLevelLimits(1, 3); // 设置缩放限制
    });

    // 添加开发者工具菜单
    const { Menu } = require('electron');
    const menu = Menu.buildFromTemplate([
        {
            label: '开发',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // 添加窗口关闭事件监听器，询问是否保存未保存的更改
    mainWindow.on('close', async (e) => {
        e.preventDefault();
        // 通知渲染进程，询问是否有未保存的更改
        const shouldClose = await mainWindow.webContents.executeJavaScript('handleAppClose()');
        if (shouldClose) {
            // 解除事件绑定，防止无限循环
            mainWindow.removeAllListeners('close');
            mainWindow.close();
        }
    });
}

// 处理 Redis 连接
ipcMain.handle('connect-redis', async (event, host, port, password) => {
    try {
        client = redis.createClient({
            socket: {
                host: host,
                port: parseInt(port)
            },
            password: password || undefined
        });

        client.on('error', (err) => {
            console.error('Redis Client Error', err);
            event.sender.send('redis-error', err.message);
        });

        await client.connect();

        return true;
    } catch (error) {
        console.error('Error connecting to Redis:', error);
        throw error;
    }
});

// 获取流程的 Redis 键名
function getFlowKey(flowName) {
    if (flowName) {
        return `chat_flow_config_flow:${flowName}`;
    } else {
        return 'chat_flow_config';
    }
}

// 获取流程列表（排除默认流程）
ipcMain.handle('get-flow-list', async (event) => {
    try {
        const keys = await client.keys('chat_flow_config_flow:*');
        const flowNames = keys.map(key => key.replace('chat_flow_config_flow:', ''));
        return flowNames;
    } catch (error) {
        console.error('Error getting flow list:', error);
        throw error;
    }
});

// 获取默认流程名称
ipcMain.handle('get-default-flow', async (event) => {
    try {
        const defaultFlowName = await client.get('chat_flow_config_default_flow');
        return defaultFlowName || 'default';
    } catch (error) {
        console.error('Error getting default flow:', error);
        throw error;
    }
});

// 创建新的流程
ipcMain.handle('create-flow', async (event, flowName, initialData) => {
    try {
        if (flowName === 'default') {
            throw new Error('流程名称不能为 "default"。');
        }
        const key = getFlowKey(flowName);
        const exists = await client.exists(key);
        if (exists) {
            throw new Error('流程已存在');
        }
        await client.set(key, JSON.stringify(initialData, null, 2));
        return true;
    } catch (error) {
        console.error('Error creating flow:', error);
        throw error;
    }
});

// 删除流程
ipcMain.handle('delete-flow', async (event, flowName) => {
    try {
        const defaultFlow = await client.get('chat_flow_config_default_flow') || 'default';
        if (defaultFlow === flowName) {
            throw new Error('无法删除默认流程。请先将其他流程设为默认流程。');
        }
        const key = getFlowKey(flowName);
        await client.del(key);

        return true;
    } catch (error) {
        console.error('Error deleting flow:', error);
        throw error;
    }
});

// 设置默认流程，并备份旧的默认流程
ipcMain.handle('set-default-flow', async (event, flowName) => {
    try {
        const currentDefaultFlow = await client.get('chat_flow_config_default_flow') || 'default';
        if (currentDefaultFlow === flowName) {
            // 已经是默认流程
            return true;
        }

        // 获取当前默认流程的数据
        const currentDefaultData = await client.get('chat_flow_config');
        if (currentDefaultData) {
            // 创建备份
            let backupName = '备份';
            let backupKey = getFlowKey(backupName);
            let index = 1;
            while (await client.exists(backupKey)) {
                backupName = `备份${index}`;
                backupKey = getFlowKey(backupName);
                index++;
            }
            await client.set(backupKey, currentDefaultData);
        }

        // 设置新的默认流程
        const key = flowName === 'default' ? 'chat_flow_config' : getFlowKey(flowName);
        const exists = await client.exists(key);
        if (!exists) {
            throw new Error('未找到流程');
        }
        const data = await client.get(key);
        if (!data) {
            throw new Error('流程数据为空');
        }

        // 设置默认流程名称
        await client.set('chat_flow_config_default_flow', flowName);

        // 将所选流程的数据复制到 'chat_flow_config'
        await client.set('chat_flow_config', data);

        return true;
    } catch (error) {
        console.error('Error setting default flow:', error);
        throw error;
    }
});

// 获取流程配置
ipcMain.handle('get-config', async (event, flowName) => {
    try {
        const key = flowName === 'default' ? 'chat_flow_config' : getFlowKey(flowName);
        const data = await client.get(key);
        return data;
    } catch (error) {
        console.error('Error getting config:', error);
        throw error;
    }
});

// 保存流程配置
ipcMain.handle('save-config', async (event, flowName, configData) => {
    try {
        const key = flowName === 'default' ? 'chat_flow_config' : getFlowKey(flowName);
        await client.set(key, configData);

        // 如果当前保存的流程是默认流程，需要同步更新 'chat_flow_config'
        const defaultFlow = await client.get('chat_flow_config_default_flow') || 'default';
        if (defaultFlow === flowName) {
            await client.set('chat_flow_config', configData);
        }
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        throw error;
    }
});

// 导出流程配置为 JSON 文件
ipcMain.handle('export-config-json', async (event, flowName, configData) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: '导出为 JSON 文件',
            defaultPath: `${flowName}.json`,
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
        if (canceled) return false; // 用户取消了操作，返回 false

        fs.writeFileSync(filePath, configData, 'utf8');
        return true;
    } catch (error) {
        console.error('Error exporting config to JSON:', error);
        throw error;
    }
});

// 打开文件选择对话框
ipcMain.handle('open-file-dialog', async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: '导入 JSON 文件',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            properties: ['openFile']
        });
        if (canceled || filePaths.length === 0) {
            return null;
        }
        return filePaths[0];
    } catch (error) {
        console.error('Error opening file dialog:', error);
        throw error;
    }
});

// 导入流程配置
ipcMain.handle('import-flow', async (event, flowName, configData) => {
    try {
        if (flowName === 'default') {
            throw new Error('流程名称不能为 "default"。');
        }
        const key = getFlowKey(flowName);
        const exists = await client.exists(key);
        if (exists) {
            throw new Error('流程名称已存在');
        }
        await client.set(key, JSON.stringify(configData, null, 2));
        return true;
    } catch (error) {
        console.error('Error importing flow:', error);
        throw error;
    }
});

// 重命名流程
ipcMain.handle('rename-flow', async (event, oldFlowName, newFlowName) => {
    try {
        if (newFlowName === 'default') {
            throw new Error('流程名称不能为 "default"。');
        }

        const oldKey = getFlowKey(oldFlowName);
        const newKey = getFlowKey(newFlowName);

        const exists = await client.exists(newKey);
        if (exists) {
            throw new Error('新流程名称已存在');
        }

        // 检查旧的流程是否存在
        const oldExists = await client.exists(oldKey);
        if (!oldExists) {
            throw new Error('要重命名的流程不存在');
        }

        // 执行重命名（在 Redis 中是通过复制删除实现的，因为 Redis 不支持直接重命名键）
        const data = await client.get(oldKey);
        await client.set(newKey, data);
        await client.del(oldKey);

        // 如果被重命名的流程是默认流程，需要更新默认流程名称
        const defaultFlow = await client.get('chat_flow_config_default_flow') || 'default';
        if (defaultFlow === oldFlowName) {
            await client.set('chat_flow_config_default_flow', newFlowName);
        }

        return true;
    } catch (error) {
        console.error('Error renaming flow:', error);
        throw error;
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});