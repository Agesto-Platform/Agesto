"""Gera os ícones e o splash do app a partir do símbolo "Bloco" (KAN-21).

Uso (na raiz do repositório): python mobile/scripts/gerar-icones.py mobile/assets/images
Precisa do Pillow (pip install pillow). Rode de novo se o símbolo ou a cor mudar.
"""
import sys
from PIL import Image, ImageDraw

SS = 4  # supersampling para bordas suaves
PETROLEO = "#1D4E6B"     # brand do app (mobile/src/ui/theme.ts)
BLOCO = "#FFFFFF"
PONTO = "#A9C8DC"        # --logo-dot da paleta Azul petróleo (web/src/styles/tokens.css)

def marca(draw, ox, oy, s, bloco, ponto):
    # Mesmo desenho de web/src/components/Logo.tsx (viewBox 18 16 86 88):
    # retângulo 62..104 com meio círculo à esquerda (centro 62,60, raio 44)
    # e o ponto (centro 58,60, raio 17).
    X = lambda x: ox + (x - 18) * s
    Y = lambda y: oy + (y - 16) * s
    draw.rectangle([X(62), Y(16), X(104), Y(104)], fill=bloco)
    draw.pieslice([X(18), Y(16), X(106), Y(104)], 90, 270, fill=bloco)
    if ponto is not None:
        draw.ellipse([X(41), Y(43), X(75), Y(77)], fill=ponto)

def imagem(w, h, fundo, bloco, ponto, altura_marca):
    """altura_marca: fração da altura do canvas ocupada pela marca."""
    W, H = w * SS, h * SS
    im = Image.new("RGBA", (W, H), fundo)
    s = H * altura_marca / 88
    marca(ImageDraw.Draw(im), (W - 86 * s) / 2, (H - 88 * s) / 2, s, bloco, ponto)
    return im.resize((w, h), Image.LANCZOS)

def monocromatico(tam, altura_marca):
    # O Android usa só o canal alfa: o ponto vira recorte transparente.
    W = tam * SS
    mascara = Image.new("L", (W, W), 0)
    s = W * altura_marca / 88
    marca(ImageDraw.Draw(mascara), (W - 86 * s) / 2, (W - 88 * s) / 2, s, 255, 0)
    im = Image.new("RGBA", (W, W), (255, 255, 255, 0))
    im.putalpha(mascara)
    return im.resize((tam, tam), Image.LANCZOS)

if __name__ == "__main__":
    pasta = sys.argv[1]
    transparente = (0, 0, 0, 0)
    # Ícone geral (1024): fundo petróleo, marca em ~50% da altura.
    imagem(1024, 1024, PETROLEO, BLOCO, PONTO, 0.50).save(f"{pasta}/icon.png", optimize=True)
    # Ícone adaptativo: a área segura é o círculo central de 66%; marca em 40%.
    imagem(512, 512, transparente, BLOCO, PONTO, 0.40).save(f"{pasta}/android-icon-foreground.png", optimize=True)
    Image.new("RGBA", (512, 512), PETROLEO).save(f"{pasta}/android-icon-background.png", optimize=True)
    monocromatico(432, 0.40).save(f"{pasta}/android-icon-monochrome.png", optimize=True)
    # Splash: a marca inteira sobre o fundo petróleo do expo-splash-screen.
    imagem(512, 512, transparente, BLOCO, PONTO, 0.96).save(f"{pasta}/splash-icon.png", optimize=True)
    imagem(48, 48, PETROLEO, BLOCO, PONTO, 0.62).save(f"{pasta}/favicon.png", optimize=True)
