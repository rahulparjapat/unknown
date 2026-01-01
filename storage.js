// Storage Management - IndexedDB + LocalStorage

const DB_NAME = 'SSC_Solo_Leveling';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';
const RETENTION_DAYS = 90;

let db = null;

// Initialize IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            if (!database.objectStoreNames.contains(IMAGE_STORE)) {
                const store = database.createObjectStore(IMAGE_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('sessionId', 'sessionId', { unique: false });
            }
        };
    });
}

// Compress image using canvas
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 1024px)
                let width = img.width;
                let height = img.height;
                const maxDimension = 1024;
                
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob (WebP if supported, else JPEG)
                const quality = 0.7;
                const mimeType = 'image/jpeg'; // WebP not universally supported in canvas.toBlob
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Image compression failed'));
                    }
                }, mimeType, quality);
            };
            
            img.onerror = () => reject(new Error('Image loading failed'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

// Save image to IndexedDB
async function saveImage(file, sessionId, type = 'photo') {
    try {
        if (!db) await initDB();
        
        const compressedBlob = await compressImage(file);
        
        const imageData = {
            blob: compressedBlob,
            sessionId: sessionId,
            type: type,
            timestamp: Date.now(),
            size: compressedBlob.size
        };
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([IMAGE_STORE], 'readwrite');
            const store = transaction.objectStore(IMAGE_STORE);
            const request = store.add(imageData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error saving image:', error);
        throw error;
    }
}

// Get image from IndexedDB
async function getImage(imageId) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGE_STORE], 'readonly');
        const store = transaction.objectStore(IMAGE_STORE);
        const request = store.get(imageId);
        
        request.onsuccess = () => {
            if (request.result) {
                const url = URL.createObjectURL(request.result.blob);
                resolve(url);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Delete old images (90+ days)
async function cleanupOldImages() {
    if (!db) await initDB();
    
    const cutoffTime = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGE_STORE], 'readwrite');
        const store = transaction.objectStore(IMAGE_STORE);
        const index = store.index('timestamp');
        const range = IDBKeyRange.upperBound(cutoffTime);
        const request = index.openCursor(range);
        
        let deletedCount = 0;
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                deletedCount++;
                cursor.continue();
            } else {
                resolve(deletedCount);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

// Get storage usage estimate
async function getStorageUsage() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGE_STORE], 'readonly');
        const store = transaction.objectStore(IMAGE_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const images = request.result;
            const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0);
            const count = images.length;
            
            resolve({
                count: count,
                sizeBytes: totalSize,
                sizeMB: (totalSize / (1024 * 1024)).toFixed(2)
            });
        };
        
        request.onerror = () => reject(request.error);
    });
}

// LocalStorage helpers
const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error writing to localStorage:', error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }
};

// Export reminder tracking
function checkExportReminder() {
    const lastExport = Storage.get('lastExportReminder', 0);
    const daysSinceExport = (Date.now() - lastExport) / (1000 * 60 * 60 * 24);
    
    return daysSinceExport >= 14;
}

function setExportReminder() {
    Storage.set('lastExportReminder', Date.now());
}

// Initialize on load
initDB().catch(err => console.error('Failed to initialize IndexedDB:', err));