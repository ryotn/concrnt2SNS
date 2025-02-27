import axios from 'axios';

class Threads {
    sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))
    static graphApiVersion = 'v1.0';
    static BASE_URL = `https://graph.threads.net/${Threads.graphApiVersion}/`;

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
        const userId = await Threads.getUserId(accessToken);

        return new Threads(accessToken, userId);
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
                const containerId = await this.createContainer({media_type: 'TEXT' ,text: text})
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
                            is_carousel_item : true,
                            media_type: 'IMAGE',
                            image_url: file.url,
                        });
                    } else {
                        return await this.createContainer({
                            is_carousel_item : true,
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
}

export default Threads;