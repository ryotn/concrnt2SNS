import axios from 'axios';
import { readFile, writeFile } from 'fs/promises';

class Threads {
    sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))
    static graphApiVersion = 'v1.0';
    static BASE_URL = `https://graph.threads.net/${Threads.graphApiVersion}/`;
    static TOKEN_LIMIT_DAYS = 30 * 24 * 60 * 60 * 1000; // 30日間

    constructor(accessToken, userId) {
        this.accessToken = accessToken;
        this.threadsUserId = userId;
        this.CREATE_CONTAINER_URL = `${Threads.BASE_URL}${this.threadsUserId}/threads`;
        this.CONTAINER_STATUS_URL = `${Threads.BASE_URL}`;
        this.PUBLISH_URL = `${Threads.BASE_URL}${this.threadsUserId}/threads_publish`;
        this.HEADERS = {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
            },
        }
    }

    static async create(accessToken) {
        let token = await Threads.loadAuth() || accessToken;
        const tokenInfo = await Threads.getTokenInfo(token);
        if (tokenInfo.is_valid === false) {
            console.error('無効なアクセストークンです。Threadsクライアントの作成に失敗しました。');
            return false;
        }

        let expires_at = (tokenInfo.expires_at * 1000) - Threads.TOKEN_LIMIT_DAYS;

        if (expires_at < Date.now() + Threads.TOKEN_LIMIT_DAYS) {
            const newToken = await Threads.getRefreshToken(token);
            if (newToken) {
                await Threads.saveAuth(newToken);
                token = newToken.access_token;
                expires_at = newToken.expires_at;
            }
        }

        const userId = await Threads.getUserId(token);
        const client = new Threads(token, userId);
        client.startNextRefreshTokenTimer(expires_at, token);
        return client;
    }

    static async getTokenInfo(accessToken) {
        try {
            const response = await axios.get(
                `https://graph.threads.net/${Threads.graphApiVersion}/debug_token?access_token=${accessToken}&input_token=${accessToken}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            console.log('アクセストークン情報:', response.data.data);
            return response.data.data;
        } catch (error) {
            console.error('アクセストークンの情報取得に失敗しました:', error.message);
            return { is_valid: false }
        }
    }

    static async getRefreshToken(accessToken) {
        try {
            const response = await axios.get(
                `https://graph.threads.net/${Threads.graphApiVersion}/refresh_access_token?grant_type=th_refresh_token&access_token=${accessToken}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            return {
                "access_token": response.data.access_token,
                "token_type": response.data.token_type,
                "expires_at": Date.now() + (response.data.expires_in * 1000)
            };
        } catch (error) {
            console.error('アクセストークンの情報取得に失敗しました:', error.message);
            return undefined
        }
    }

    startNextRefreshTokenTimer(expires_at_ms, accessToken) {
        // timeoutの最大値は2147483647ms(約24.8日)なので最大値は超えないようにする
        const delay = Math.min(expires_at_ms - Date.now() - Threads.TOKEN_LIMIT_DAYS, 2147483647);
        if (delay > 0) {
            setTimeout(async () => {
                const newToken = await Threads.getRefreshToken(accessToken);
                if (newToken) {
                    await Threads.saveAuth(newToken);
                    console.log('Threadsの新しいアクセストークンを取得しました');
                    this.accessToken = newToken.access_token;
                    this.HEADERS = {
                        headers: {
                            Authorization: `Bearer ${this.accessToken}`,
                        },
                    };

                    this.startNextRefreshTokenTimer(newToken.expires_at, newToken.access_token);
                }
            }, delay);
        }
    }

    static async getUserId(accessToken) {
        try {
            const response = await axios.get(
                `https://graph.threads.net/${Threads.graphApiVersion}/me`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            return response.data.id;
        } catch (error) {
            console.error('ユーザーIDの取得に失敗しました:', error.message);
        }
    }

    async post(text, fileBuffer) {
        try {
            if (fileBuffer.length === 0) {
                // テキストのみの投稿
                const containerId = await this.createContainer({ media_type: 'TEXT', text: text })
                while (await this.getContainerStatus(containerId) === false) {
                    await this.sleep(1000)
                }
                await this.publishContainer(containerId)
            } else if (fileBuffer.length === 1) {
                // シングルメディアの投稿
                const mediaType = fileBuffer[0].type.startsWith('image') ? 'IMAGE' : 'VIDEO'
                const data = {
                    media_type: mediaType,
                    text: text,
                }

                var wait = 1000
                if (mediaType === 'IMAGE') {
                    data.image_url = fileBuffer[0].url
                    wait = 1000
                } else {
                    data.video_url = fileBuffer[0].url
                    wait = 35000
                }

                const containerId = await this.createContainer(data)
                while (await this.getContainerStatus(containerId) === false) {
                    await this.sleep(wait)
                }
                await this.publishContainer(containerId)
            } else {
                // カルーセル投稿
                const carouselItems = await Promise.all(fileBuffer.map(async (file) => {
                    if (file.type.startsWith('image')) {
                        return await this.createContainer({
                            is_carousel_item: true,
                            media_type: 'IMAGE',
                            image_url: file.url,
                        });
                    } else {
                        return await this.createContainer({
                            is_carousel_item: true,
                            media_type: 'VIDEO',
                            video_url: file.url,
                        });
                    }
                }).filter(v => v));

                await Promise.all(carouselItems.map(async (id) => {
                    while (await this.getContainerStatus(id) === false) {
                        await this.sleep(10000);
                    }
                }))

                const containerId = await this.createContainer({
                    media_type: 'CAROUSEL',
                    children: carouselItems,
                    text: text,
                });

                await this.sleep(1000)
                while (await this.getContainerStatus(containerId) === false) {
                    await this.sleep(5000)
                }

                await this.publishContainer(containerId);
            }
        } catch (error) {
            console.error('投稿に失敗しました:', error.message);
        }
    }

    async createContainer(data) {
        try {
            const response = await axios.post(
                this.CREATE_CONTAINER_URL,
                data,
                this.HEADERS
            );
            return response.data.id;
        } catch (error) {
            console.error('コンテナの作成に失敗しました:', error.message);
        }
    }

    async getContainerStatus(id) {
        try {
            const response = await axios.get(
                `${this.CONTAINER_STATUS_URL}${id}?fields=status`,
                this.HEADERS
            );
            return response.data.status === 'PUBLISHED' || response.data.status === 'FINISHED'
        } catch (error) {
            console.error('コンテナのステータス取得に失敗しました:', error.message);
        }
    }

    async publishContainer(containerId) {
        try {
            await axios.post(
                this.PUBLISH_URL,
                {
                    creation_id: containerId,
                },
                this.HEADERS
            );
        } catch (error) {
            console.error('コンテナの公開に失敗しました:', error.message);
        }
    }

    static async saveAuth(authData, filePath = './threads_auth.json') {
        // JSON文字列に変換して保存
        await writeFile(filePath, JSON.stringify(authData, null, 2), 'utf8');
    }

    static async loadAuth(filePath = './threads_auth.json') {
        try {
            const authRaw = await readFile(filePath, 'utf8');
            return JSON.parse(authRaw).access_token;
        } catch (err) {
            // ファイルが無い場合など
            console.log('認証情報ファイルの読込エラー:', err);
            return undefined;
        }
    }
}

export default Threads;