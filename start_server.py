import http.server
import socketserver
import webbrowser
import os
import sys

# 设置端口
PORT = 8000

# 确保在脚本所在目录运行
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加必要的头部以支持 SharedArrayBuffer (如果未来需要) 和 CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        # 禁用缓存，确保每次都获取最新文件
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# 尝试寻找可用端口
while True:
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"服务已启动: http://localhost:{PORT}")
            print("请不要关闭此窗口，在浏览器中访问上述地址即可使用。")
            
            # 自动打开浏览器
            webbrowser.open(f"http://localhost:{PORT}")
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n服务已停止。")
                sys.exit(0)
            break
    except OSError:
        PORT += 1
