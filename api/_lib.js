function extractTextFromRaw(raw) {
  if (!raw) return "";

  let body = raw;

  // ambil isi setelah header utama
  const splitIndex = raw.search(/\r?\n\r?\n/);
  if (splitIndex !== -1) {
    body = raw.slice(splitIndex + raw.match(/\r?\n\r?\n/)[0].length);
  }

  // hapus boundary MIME
  body = body.replace(/--[-_A-Za-z0-9=.]+/g, " ");

  // hapus header MIME di dalam body
  body = body.replace(/^Content-[^\n]*$/gim, " ");
  body = body.replace(/^MIME-Version:[^\n]*$/gim, " ");
  body = body.replace(/^charset=[^\n]*$/gim, " ");

  // decode quoted-printable
  body = body.replace(/=\r?\n/g, "");
  body = body.replace(/=([A-F0-9]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  // hapus block yang bikin berisik
  body = body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // ubah tag html penting ke newline
  body = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n");

  // hapus semua tag html lain
  body = body.replace(/<[^>]+>/g, " ");

  // decode entity dasar
  body = body
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // pecah per baris lalu rapikan agresif
  let lines = body.split(/\r?\n/).map(line =>
    line
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim()
  );

  // buang line sampah
  lines = lines.filter(line => {
    if (!line) return false;
    if (/^=+$/.test(line)) return false;
    if (/^[-_]{2,}$/.test(line)) return false;
    if (/^Content-Type:/i.test(line)) return false;
    if (/^Content-Transfer-Encoding:/i.test(line)) return false;
    if (/^MIME-Version:/i.test(line)) return false;
    if (/^charset=/i.test(line)) return false;
    return true;
  });

  // gabung tanpa blank line berlebihan
  body = lines.join("\n");

  // rapikan spacing akhir
  body = body
    .replace(/\n{2,}/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  return body.slice(0, 20000);
}
