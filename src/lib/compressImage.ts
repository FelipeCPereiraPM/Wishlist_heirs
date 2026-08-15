// Comprime e redimensiona uma imagem no navegador via canvas, antes do upload.
// - Reduz para no máximo 256×256 px (suficiente para avatar).
// - Converte para JPEG quality 0.8 (reduz ~90% do tamanho vs PNG original).
// - Sem dependências externas (usa canvas nativo do browser).
// Retorna um File pronto para upload.

const MAX_DIMENSION = 256;
const JPEG_QUALITY = 0.8;

export const compressAvatar = async (file: File): Promise<File> => {
  // Se não for imagem, retorna como está (a validação de tipo acontece no caller).
  if (!file.type.startsWith('image/')) return file;

  // Lê a imagem para um <img> element
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  // Calcula dimensões mantendo proporção (cover na caixa 256×256)
  let { width, height } = img;
  if (width > height) {
    if (width > MAX_DIMENSION) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    }
  } else {
    if (height > MAX_DIMENSION) {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  // Desenha no canvas e exporta como JPEG
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) return file;

  // Nome do arquivo com extensão .jpg (já que saímos como JPEG)
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
};

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = src;
  });
