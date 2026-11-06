"""Gera os ícones do app (só o "V" + floco de neve) a partir de public/vini-logo.png."""
from PIL import Image, ImageDraw

SRC = "public/vini-logo.png"
logo = Image.open(SRC).convert("RGBA")

# Recorta a área do "V" com o floco de neve e apaga o início do texto "Climatização".
mark = logo.crop((0, 0, 300, 262))
px = mark.load()
for y in range(mark.height):
    for x in range(mark.width):
        if (y > 196 and x > 202) or (x >= 286 and y >= 50) or (x >= 262 and y >= 85):
            px[x, y] = (0, 0, 0, 0)
mark = mark.crop(mark.getbbox())


def icone(tamanho: int, escala: float, fundo, arredondar: bool) -> Image.Image:
    img = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
    if arredondar:
        m = Image.new("L", (tamanho, tamanho), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, tamanho - 1, tamanho - 1), radius=int(tamanho * 0.22), fill=255)
        bg = Image.new("RGBA", (tamanho, tamanho), fundo)
        img.paste(bg, (0, 0), m)
    else:
        img.paste(Image.new("RGBA", (tamanho, tamanho), fundo), (0, 0))
    alvo = int(tamanho * escala)
    r = min(alvo / mark.width, alvo / mark.height)
    m2 = mark.resize((int(mark.width * r), int(mark.height * r)), Image.LANCZOS)
    img.alpha_composite(m2, ((tamanho - m2.width) // 2, (tamanho - m2.height) // 2))
    return img


GELO = (244, 248, 254, 255)
for t in (192, 512):
    icone(t, 0.78, GELO, False).save(f"public/icon-{t}.png")
    icone(t, 0.58, GELO, False).save(f"public/icon-maskable-{t}.png")
icone(180, 0.78, GELO, False).convert("RGB").save("public/apple-touch-icon.png")
icone(64, 0.86, GELO, True).save("public/favicon.png")
mark.save("public/vini-mark.png")
print("ícones gerados")
