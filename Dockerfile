# Node.js 18をベースイメージとして使用
FROM node:18-alpine

# アプリケーションの作業ディレクトリを作成
WORKDIR /app

# 最初にpackage.jsonをコピーして、依存関係をインストール
# これにより、ソースコードの変更時に毎回npm installが走るのを防ぎ、ビルドを高速化します。
COPY package*.json ./
RUN npm install

# アプリケーションのソースコードをコピー
COPY . .

# アプリケーションがリッスンするポートを公開
EXPOSE 3000

# コンテナ起動時に実行するデフォルトコマンド
# docker-compose.ymlで上書きされるため、これはドキュメント的な意味合いが強いです。
CMD [ "npm", "run", "dev" ]