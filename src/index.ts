import { Hono } from "hono";
import { cors } from "hono/cors";
import { PDFDocument, degrees } from "pdf-lib";

// 型定義（Cloudflare Workers標準の型を使用）
type Bindings = {
	pdf_editor_files: R2Bucket;
	PDF_METADATA: KVNamespace;
};

type Variables = {
	uploadId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS設定
app.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

// 静的ファイル配信（フロントエンド）
app.get("/", (c) => {
	return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDF Editor - Powered by Hono & Cloudflare</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                text-align: center;
                color: white;
                margin-bottom: 40px;
            }
            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .main-content {
                background: white;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                padding: 30px;
            }
            .upload-area {
                border: 3px dashed #667eea;
                border-radius: 10px;
                padding: 40px;
                text-align: center;
                margin-bottom: 30px;
                cursor: pointer;
            }
            .upload-area:hover {
                background: #f0f3ff;
            }
            .btn {
                background: #28a745;
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 8px;
                cursor: pointer;
                margin: 10px 5px;
            }
            .btn:hover {
                background: #218838;
            }
            .form-control {
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                margin: 10px 0;
            }
            .result {
                margin: 20px 0;
                padding: 15px;
                border-radius: 8px;
            }
            .success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            .error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            .file-input {
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📄 PDF Editor</h1>
                <p>Cloudflare Workers × Honoで動作する高速PDFエディタ</p>
            </div>
            <div class="main-content">
                <div class="upload-area" onclick="document.getElementById('fileInput').click()">
                    <h3>📎 PDFファイルをアップロード</h3>
                    <p>クリックしてファイルを選択してください</p>
                    <input type="file" id="fileInput" class="file-input" accept=".pdf" />
                </div>

                <div id="fileInfo" style="display: none;">
                    <h3>📋 操作メニュー</h3>
                    <p id="fileName"></p>
                    <p id="pageCount"></p>

                    <div>
                        <label>抽出するページ番号 (例: 1,3,5-7):</label>
                        <input type="text" id="extractPages" class="form-control" placeholder="1,3,5-7" />
                        <button class="btn" onclick="extractPages()">ページ抽出</button>
                    </div>

                    <div>
                        <label>回転設定 (JSON形式):</label>
                        <input type="text" id="rotatePages" class="form-control" placeholder='{"1":90,"2":180}' />
                        <button class="btn" onclick="rotatePages()">ページ回転</button>
                    </div>
                </div>

                <div id="result"></div>
            </div>
        </div>

        <script>
            let currentUploadId = '';

            document.getElementById('fileInput').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file || file.type !== 'application/pdf') {
                    showResult('PDFファイルを選択してください', 'error');
                    return;
                }

                const formData = new FormData();
                formData.append('pdfFile', file);

                try {
                    showResult('アップロード中...', 'info');
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();
                    if (result.success) {
                        currentUploadId = result.uploadId;
                        document.getElementById('fileName').textContent = 'ファイル名: ' + result.filename;
                        document.getElementById('pageCount').textContent = 'ページ数: ' + result.pageCount;
                        document.getElementById('fileInfo').style.display = 'block';
                        showResult('ファイルが正常にアップロードされました', 'success');
                    } else {
                        showResult(result.error, 'error');
                    }
                } catch (error) {
                    showResult('ファイル処理中にエラーが発生しました', 'error');
                }
            });

            async function extractPages() {
                const pages = document.getElementById('extractPages').value;
                if (!pages || !currentUploadId) {
                    showResult('ページ番号を入力してください', 'error');
                    return;
                }

                try {
                    showResult('ページ抽出中...', 'info');
                    const response = await fetch('/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId: currentUploadId, pages })
                    });

                    const result = await response.json();
                    if (result.success) {
                        showResult('ページが抽出されました: <a href="' + result.downloadUrl + '" target="_blank">ダウンロード</a>', 'success');
                    } else {
                        showResult(result.error, 'error');
                    }
                } catch (error) {
                    showResult('ページ抽出中にエラーが発生しました', 'error');
                }
            }

            async function rotatePages() {
                const rotateInput = document.getElementById('rotatePages').value;
                if (!rotateInput || !currentUploadId) {
                    showResult('回転設定を入力してください', 'error');
                    return;
                }

                try {
                    const rotations = JSON.parse(rotateInput);
                    showResult('ページ回転中...', 'info');

                    const response = await fetch('/rotate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId: currentUploadId, rotations })
                    });

                    const result = await response.json();
                    if (result.success) {
                        showResult('ページが回転されました: <a href="' + result.downloadUrl + '" target="_blank">ダウンロード</a>', 'success');
                    } else {
                        showResult(result.error, 'error');
                    }
                } catch (error) {
                    showResult('ページ回転中にエラーが発生しました', 'error');
                }
            }

            function showResult(message, type) {
                const resultDiv = document.getElementById('result');
                resultDiv.innerHTML = '<div class="result ' + type + '">' + message + '</div>';
            }
        </script>
    </body>
    </html>
  `);
});
app.get("/static/*", (c) => {
	return c.text("Static files not implemented in this version", 404);
});

// ヘルスチェック
app.get("/health", (c) => {
	return c.json({
		status: "OK",
		timestamp: new Date().toISOString(),
		worker: "Hono PDF Editor",
	});
});

// ファイルアップロード
app.post("/upload", async (c) => {
	try {
		const formData = await c.req.formData();
		const file = formData.get("pdfFile") as File;

		if (!file) {
			return c.json({ error: "ファイルがアップロードされていません" }, 400);
		}

		if (file.type !== "application/pdf") {
			return c.json({ error: "PDFファイルのみアップロード可能です" }, 400);
		}

		// ファイルサイズチェック（50MB）
		if (file.size > 50 * 1024 * 1024) {
			return c.json({ error: "ファイルサイズが大きすぎます（最大50MB）" }, 400);
		}

		const fileBuffer = await file.arrayBuffer();
		const uploadId = generateUploadId();

		// PDF解析してページ数取得
		let pageCount = 0;
		try {
			const pdfDoc = await PDFDocument.load(fileBuffer);
			pageCount = pdfDoc.getPageCount();
		} catch (error) {
			return c.json({ error: "無効なPDFファイルです" }, 400);
		}

		// R2にファイル保存
		const bucket = c.env.pdf_editor_files;
		await bucket.put(`uploads/${uploadId}.pdf`, fileBuffer, {
			httpMetadata: {
				contentType: "application/pdf",
			},
			customMetadata: {
				originalName: file.name,
				pageCount: pageCount.toString(),
				uploadTime: new Date().toISOString(),
			},
		});

		// メタデータをKVに保存
		const metadata = {
			filename: file.name,
			pageCount,
			uploadTime: new Date().toISOString(),
			size: file.size,
		};

		await c.env.PDF_METADATA.put(uploadId, JSON.stringify(metadata), {
			expirationTtl: 24 * 60 * 60, // 24時間後に削除
		});

		return c.json({
			success: true,
			uploadId,
			filename: file.name,
			pageCount,
			message: `PDFが正常にアップロードされました。総ページ数: ${pageCount}`,
		});
	} catch (error) {
		console.error("Upload error:", error);
		return c.json({ error: "ファイルの処理中にエラーが発生しました" }, 500);
	}
});

// ページ抽出
app.post("/extract", async (c) => {
	try {
		const { uploadId, pages } = await c.req.json();

		if (!uploadId || !pages) {
			return c.json({ error: "アップロードIDとページ番号が必要です" }, 400);
		}

		// R2からファイル取得
		const bucket = c.env.pdf_editor_files;
		const object = await bucket.get(`uploads/${uploadId}.pdf`);

		if (!object) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const pdfBytes = await object.arrayBuffer();
		const pdfDoc = await PDFDocument.load(pdfBytes);
		const totalPages = pdfDoc.getPageCount();

		// ページ番号を解析
		const pageNumbers = parsePageNumbers(pages, totalPages);

		if (pageNumbers.length === 0) {
			return c.json({ error: "有効なページ番号を指定してください" }, 400);
		}

		// 新しいPDFを作成
		const newPdfDoc = await PDFDocument.create();

		for (const pageNum of pageNumbers) {
			const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
			newPdfDoc.addPage(copiedPage);
		}

		const newPdfBytes = await newPdfDoc.save();
		const outputId = generateUploadId();

		// 抽出結果をR2に保存
		await bucket.put(`outputs/${outputId}.pdf`, newPdfBytes, {
			httpMetadata: {
				contentType: "application/pdf",
			},
			customMetadata: {
				type: "extracted",
				originalUploadId: uploadId,
				extractedPages: pageNumbers.join(","),
				createdTime: new Date().toISOString(),
			},
		});

		return c.json({
			success: true,
			outputId,
			downloadUrl: `/download/${outputId}`,
			message: `${pageNumbers.length}ページが抽出されました`,
			extractedPages: pageNumbers,
		});
	} catch (error) {
		console.error("Extract error:", error);
		return c.json({ error: "ページ抽出中にエラーが発生しました" }, 500);
	}
});

// ページ回転
app.post("/rotate", async (c) => {
	try {
		const { uploadId, rotations } = await c.req.json();

		if (!uploadId || !rotations) {
			return c.json({ error: "アップロードIDと回転情報が必要です" }, 400);
		}

		// R2からファイル取得
		const bucket = c.env.pdf_editor_files;
		const object = await bucket.get(`uploads/${uploadId}.pdf`);

		if (!object) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const pdfBytes = await object.arrayBuffer();
		const pdfDoc = await PDFDocument.load(pdfBytes);
		const pages = pdfDoc.getPages();

		// 回転適用
		for (const [pageNum, rotation] of Object.entries(rotations)) {
			const pageIndex = parseInt(pageNum) - 1;
			if (pages[pageIndex] && typeof rotation === "number") {
				pages[pageIndex].setRotation(degrees(rotation));
			}
		}

		const newPdfBytes = await pdfDoc.save();
		const outputId = generateUploadId();

		// 回転結果をR2に保存
		await bucket.put(`outputs/${outputId}.pdf`, newPdfBytes, {
			httpMetadata: {
				contentType: "application/pdf",
			},
			customMetadata: {
				type: "rotated",
				originalUploadId: uploadId,
				rotations: JSON.stringify(rotations),
				createdTime: new Date().toISOString(),
			},
		});

		return c.json({
			success: true,
			outputId,
			downloadUrl: `/download/${outputId}`,
			message: "ページの回転が完了しました",
			appliedRotations: rotations,
		});
	} catch (error) {
		console.error("Rotate error:", error);
		return c.json({ error: "ページ回転中にエラーが発生しました" }, 500);
	}
});

// ファイルダウンロード
app.get("/download/:outputId", async (c) => {
	try {
		const outputId = c.req.param("outputId");
		const bucket = c.env.pdf_editor_files;

		const object = await bucket.get(`outputs/${outputId}.pdf`);

		if (!object) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const headers = new Headers();
		headers.set("Content-Type", "application/pdf");
		headers.set(
			"Content-Disposition",
			`attachment; filename="processed_${outputId}.pdf"`,
		);
		headers.set("Cache-Control", "public, max-age=3600");

		return new Response(object.body, { headers });
	} catch (error) {
		console.error("Download error:", error);
		return c.json({ error: "ダウンロード中にエラーが発生しました" }, 500);
	}
});

// アップロードされたファイル一覧
app.get("/files", async (c) => {
	try {
		const bucket = c.env.pdf_editor_files;
		const objects = await bucket.list({ prefix: "uploads/" });

		const files = await Promise.all(
			objects.objects.map(async (obj) => {
				const uploadId = obj.key.replace("uploads/", "").replace(".pdf", "");
				const metadata = await c.env.PDF_METADATA.get(uploadId);

				return {
					uploadId,
					key: obj.key,
					size: obj.size,
					uploaded: obj.uploaded,
					metadata: metadata ? JSON.parse(metadata) : null,
				};
			}),
		);

		return c.json({ files });
	} catch (error) {
		console.error("Files list error:", error);
		return c.json({ error: "ファイル一覧の取得に失敗しました" }, 500);
	}
});

// ファイル削除
app.delete("/file/:uploadId", async (c) => {
	try {
		const uploadId = c.req.param("uploadId");
		const bucket = c.env.pdf_editor_files;

		// アップロードファイルを削除
		await bucket.delete(`uploads/${uploadId}.pdf`);

		// メタデータを削除
		await c.env.PDF_METADATA.delete(uploadId);

		// 関連する出力ファイルも削除
		const outputs = await bucket.list({ prefix: "outputs/" });
		for (const obj of outputs.objects) {
			if (obj.customMetadata?.originalUploadId === uploadId) {
				await bucket.delete(obj.key);
			}
		}

		return c.json({
			success: true,
			message: "ファイルが削除されました",
		});
	} catch (error) {
		console.error("Delete error:", error);
		return c.json({ error: "ファイル削除に失敗しました" }, 500);
	}
});

// ユーティリティ関数
function generateUploadId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function parsePageNumbers(pagesString: string, totalPages: number): number[] {
	const pages: number[] = [];
	const parts = pagesString.split(",");

	for (const part of parts) {
		const trimmed = part.trim();

		if (trimmed.indexOf("-") !== -1) {
			// 範囲指定 (例: "5-7")
			const [start, end] = trimmed.split("-").map((n) => parseInt(n.trim()));
			if (!isNaN(start) && !isNaN(end)) {
				for (let i = start; i <= Math.min(end, totalPages); i++) {
					if (i >= 1) pages.push(i);
				}
			}
		} else {
			// 単一ページ
			const pageNum = parseInt(trimmed);
			if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
				pages.push(pageNum);
			}
		}
	}

	// 重複を除去してソート
	const uniquePages = Array.from(new Set(pages));
	return uniquePages.sort((a, b) => a - b);
}

export default app;
