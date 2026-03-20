const fs = require("fs");
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach((size) => {
  const r = Math.round(size * 0.15);
  const fs1 = Math.round(size * 0.32);
  const fs2 = Math.round(size * 0.13);
  const svg = [
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + size + "\" height=\"" + size + "\" viewBox=\"0 0 " + size + " " + size + "\">",
    "  <rect width=\"" + size + "\" height=\"" + size + "\" rx=\"" + r + "\" fill=\"#3498db\"/>",
    "  <text x=\"50%\" y=\"42%\" dominant-baseline=\"middle\" text-anchor=\"middle\" font-family=\"Arial,sans-serif\" font-weight=\"bold\" font-size=\"" + fs1 + "\" fill=\"white\">A$</text>",
    "  <text x=\"50%\" y=\"72%\" dominant-baseline=\"middle\" text-anchor=\"middle\" font-family=\"Arial,sans-serif\" font-weight=\"600\" font-size=\"" + fs2 + "\" fill=\"rgba(255,255,255,0.85)\">AlgoSave</text>",
    "</svg>"
  ].join("\n");
  const outPath = "D:/aaditya/PW-DhanSathi/public/icons/icon-" + size + "x" + size + ".svg";
  fs.writeFileSync(outPath, svg);
  console.log("Created " + outPath);
});
