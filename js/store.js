// 录音室的本地存储（IndexedDB）：刷新、关掉页面后录音还在。
// takes 存名字、时长、分析结果；audio 存录音数据（ArrayBuffer，比直接存 Blob 在老 Safari 上可靠）；misc 存伴奏等杂项
const DB_NAME = 'music_tool.studio';
let dbp = null;

function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('takes', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('audio');
      d.createObjectStore('misc');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

// fn 拿到各个 objectStore，返回的 IDBRequest 的结果在事务完成后作为返回值
async function tx(names, mode, fn) {
  const t = (await db()).transaction(names, mode);
  const req = fn(...names.map((n) => t.objectStore(n)));
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(req?.result);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

const pack = async (blob) => ({ buf: await blob.arrayBuffer(), type: blob.type });
const unpack = (v) => v && new Blob([v.buf], { type: v.type });

export async function listTakes() {
  const all = await tx(['takes'], 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.created - a.created);
}

export async function addTake(meta, blob) {
  const data = await pack(blob);
  return tx(['takes', 'audio'], 'readwrite', (t, a) => {
    const req = t.add(meta);
    req.onsuccess = () => a.put(data, req.result);
    return req;
  });
}

export const getTake = (id) => tx(['takes'], 'readonly', (s) => s.get(id));

export const updateTake = (id, patch) => tx(['takes'], 'readwrite', (s) => {
  const req = s.get(id);
  req.onsuccess = () => req.result && s.put({ ...req.result, ...patch });
});

export const getAudio = async (id) => unpack(await tx(['audio'], 'readonly', (s) => s.get(id)));

export const deleteTake = (id) => tx(['takes', 'audio'], 'readwrite', (t, a) => { t.delete(id); a.delete(id); });

export const getMisc = (key) => tx(['misc'], 'readonly', (s) => s.get(key));
export const setMisc = (key, value) => tx(['misc'], 'readwrite', (s) => { s.put(value, key); });
export const deleteMisc = (key) => tx(['misc'], 'readwrite', (s) => { s.delete(key); });

// 伴奏文件：{ name, blob }
export async function setBacking(file) {
  await setMisc('backing', { name: file.name, ...(await pack(file)) });
}
export async function getBacking() {
  const v = await getMisc('backing');
  return v && { name: v.name, blob: unpack(v) };
}

// 请浏览器别在空间紧张时清掉数据（iOS 上加到主屏幕的才比较可靠）
export const requestPersist = () => navigator.storage?.persist?.().catch(() => false);
