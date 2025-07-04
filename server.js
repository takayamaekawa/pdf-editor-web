const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { PDFDocument, degrees } = require("pdf-lib");

const app = express();
const PORT = 3000;

// アップロードディレクトリの設定
const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "output");

// ディレクトリが存在しない場合は作成
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(outputDir);

// Multerの設定（ファイルアップロード）
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(null, file.fieldname + "-" + uniqueSuffix + ".pdf");
	},
});

const upload = multer({
	storage: storage,
	fileFilter: (req, file, cb) => {
		if (file.mimetype === "application/pdf") {
			cb(null, true);
		} else {
			cb(new Error("PDFファイルのみアップロード可能です"), false);
		}
	},
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB制限
	},
});

// 静的ファイルの配信
app.use(express.static("public"));
app.use("/output", express.static(outputDir));
app.use(express.json());

// メインページ
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

// PDFファイルのアップロード
app.post("/upload", upload.single("pdfFile"), async (req, res) => {
	try {
		if (!req.file) {
			return res
				.status(400)
				.json({ error: "ファイルがアップロードされていません" });
		}

		const filePath = req.file.path;
		const pdfBytes = await fs.readFile(filePath);
		const pdfDoc = await PDFDocument.load(pdfBytes);
		const pageCount = pdfDoc.getPageCount();

		res.json({
			success: true,
			filename: req.file.filename,
			pageCount: pageCount,
			message: `PDFが正常にアップロードされました。総ページ数: ${pageCount}`,
		});
	} catch (error) {
		console.error("Upload error:", error);
		res.status(500).json({ error: "ファイルの処理中にエラーが発生しました" });
	}
});

// ページ抽出
app.post("/extract", async (req, res) => {
	try {
		const { filename, pages } = req.body;

		if (!filename || !pages) {
			return res
				.status(400)
				.json({ error: "ファイル名とページ番号が必要です" });
		}

		const inputPath = path.join(uploadDir, filename);
		const pdfBytes = await fs.readFile(inputPath);
		const pdfDoc = await PDFDocument.load(pdfBytes);

		const newPdfDoc = await PDFDocument.create();

		// ページ番号を解析（例: "1,3,5-7" -> [1,3,5,6,7]）
		const pageNumbers = parsePageNumbers(pages, pdfDoc.getPageCount());

		for (const pageNum of pageNumbers) {
			const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
			newPdfDoc.addPage(copiedPage);
		}

		const newPdfBytes = await newPdfDoc.save();
		const outputFilename = `extracted_${Date.now()}.pdf`;
		const outputPath = path.join(outputDir, outputFilename);

		await fs.writeFile(outputPath, newPdfBytes);

		res.json({
			success: true,
			downloadUrl: `/output/${outputFilename}`,
			message: `${pageNumbers.length}ページが抽出されました`,
		});
	} catch (error) {
		console.error("Extract error:", error);
		res.status(500).json({ error: "ページ抽出中にエラーが発生しました" });
	}
});

// ページ回転
app.post("/rotate", async (req, res) => {
	try {
		const { filename, rotations } = req.body;

		if (!filename || !rotations) {
			return res.status(400).json({ error: "ファイル名と回転情報が必要です" });
		}

		const inputPath = path.join(uploadDir, filename);
		const pdfBytes = await fs.readFile(inputPath);
		const pdfDoc = await PDFDocument.load(pdfBytes);
		const pages = pdfDoc.getPages();

		// 回転適用
		Object.entries(rotations).forEach(([pageNum, rotation]) => {
			const pageIndex = parseInt(pageNum) - 1;
			if (pages[pageIndex]) {
				pages[pageIndex].setRotation(degrees(parseInt(rotation)));
			}
		});

		const newPdfBytes = await pdfDoc.save();
		const outputFilename = `rotated_${Date.now()}.pdf`;
		const outputPath = path.join(outputDir, outputFilename);

		await fs.writeFile(outputPath, newPdfBytes);

		res.json({
			success: true,
			downloadUrl: `/output/${outputFilename}`,
			message: "ページの回転が完了しました",
		});
	} catch (error) {
		console.error("Rotate error:", error);
		res.status(500).json({ error: "ページ回転中にエラーが発生しました" });
	}
});

// ページ番号解析関数
function parsePageNumbers(pagesString, totalPages) {
	const pages = [];
	const parts = pagesString.split(",");

	for (const part of parts) {
		const trimmed = part.trim();

		if (trimmed.includes("-")) {
			// 範囲指定 (例: "5-7")
			const [start, end] = trimmed.split("-").map((n) => parseInt(n.trim()));
			for (let i = start; i <= Math.min(end, totalPages); i++) {
				if (i >= 1) pages.push(i);
			}
		} else {
			// 単一ページ
			const pageNum = parseInt(trimmed);
			if (pageNum >= 1 && pageNum <= totalPages) {
				pages.push(pageNum);
			}
		}
	}

	// 重複を除去してソート
	return [...new Set(pages)].sort((a, b) => a - b);
}

// アップロードされたファイル一覧
app.get("/files", async (req, res) => {
	try {
		const files = await fs.readdir(uploadDir);
		const pdfFiles = files.filter((file) => file.endsWith(".pdf"));
		res.json({ files: pdfFiles });
	} catch (error) {
		res.status(500).json({ error: "ファイル一覧の取得に失敗しました" });
	}
});

// ファイル削除
app.delete("/file/:filename", async (req, res) => {
	try {
		const filename = req.params.filename;
		const filePath = path.join(uploadDir, filename);

		if (await fs.pathExists(filePath)) {
			await fs.remove(filePath);
			res.json({ success: true, message: "ファイルが削除されました" });
		} else {
			res.status(404).json({ error: "ファイルが見つかりません" });
		}
	} catch (error) {
		res.status(500).json({ error: "ファイル削除に失敗しました" });
	}
});

app.listen(PORT, () => {
	console.log(`PDF Editor Server running on http://localhost:${PORT}`);
	console.log(`Upload directory: ${uploadDir}`);
	console.log(`Output directory: ${outputDir}`);
});
