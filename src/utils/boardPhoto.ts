/** Raster-only, device-local photo support; never uploads a photo to a server. */
export const validBoardPhoto=(v:unknown):v is string=>typeof v==='string'&&v.length<=350000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v);
export async function prepareBoardPhoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP board photo.');
 if(file.size>10000000)throw new Error('Choose a photo smaller than 10 MB.');
 const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>30000000)throw new Error('Photo resolution is too large. Choose an image under 30 megapixels.');const scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo processing is unavailable.');ctx.fillStyle='#f2f0e9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);let data=canvas.toDataURL('image/jpeg',.78);if(data.length>350000)data=canvas.toDataURL('image/jpeg',.5);if(!validBoardPhoto(data))throw new Error('This photo is too detailed to save locally. Choose a smaller image.');return data;}finally{bitmap.close()}
}
