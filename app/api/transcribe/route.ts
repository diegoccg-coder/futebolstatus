import { requireAdminSession } from "@/lib/auth-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    available: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}

export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcrição por servidor não configurada (OPENAI_API_KEY)." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Áudio inválido." }, { status: 400 });
  }

  const file = formData.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Nenhum áudio recebido." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Áudio muito longo." }, { status: 400 });
  }

  const name =
    typeof formData.get("filename") === "string"
      ? String(formData.get("filename"))
      : "comando.m4a";

  const whisperBody = new FormData();
  whisperBody.append("file", file, name);
  whisperBody.append("model", "whisper-1");
  whisperBody.append("language", "pt");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperBody,
  });

  if (!whisperRes.ok) {
    const detail = await whisperRes.text().catch(() => "");
    console.error("Whisper error:", whisperRes.status, detail.slice(0, 300));
    return NextResponse.json(
      { error: "Não foi possível transcrever o áudio." },
      { status: 502 }
    );
  }

  const payload = (await whisperRes.json()) as { text?: string };
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Nenhuma fala reconhecida no áudio." }, { status: 422 });
  }

  return NextResponse.json({ text });
}
