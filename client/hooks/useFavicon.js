import { useEffect } from 'react';
import { useStore } from '../store.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFavicon(runningCount, unreadCount) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Brand background — teal gradient matching the app
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#466369');
  grad.addColorStop(1, '#3a575d');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, size, size, 14);
  ctx.fill();

  // 2x2 grid pattern (matches grid_view icon)
  ctx.fillStyle = '#e9fbff';
  const pad = 14, gap = 6;
  const sq = (size - pad * 2 - gap) / 2;
  ctx.fillRect(pad, pad, sq, sq);
  ctx.fillRect(pad + sq + gap, pad, sq, sq);
  ctx.fillRect(pad, pad + sq + gap, sq, sq);
  ctx.fillRect(pad + sq + gap, pad + sq + gap, sq, sq);

  // Running indicator — purple pulsing dot bottom-right
  // (only when no unread badge, so badges don't stack)
  if (runningCount > 0 && unreadCount === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(size - 14, size - 14, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c5cbf';
    ctx.beginPath();
    ctx.arc(size - 14, size - 14, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Unread count badge — red circle top-right
  if (unreadCount > 0) {
    const bx = size - 16, by = 16, br = 16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c44545';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, -apple-system, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = unreadCount > 9 ? '9+' : String(unreadCount);
    ctx.fillText(label, bx, by + 1);
  }

  return canvas.toDataURL('image/png');
}

function updateFaviconLink(dataUrl) {
  // Remove any existing favicon links to prevent duplicates
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => el.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = dataUrl;
  document.head.appendChild(link);
}

export function useFavicon() {
  const runningCount = useStore(s => s.poolStatus.running?.length || 0);
  const notifications = useStore(s => s.notifications);
  const activeProjectId = useStore(s => s.activeProjectId);
  const projects = useStore(s => s.projects);

  const unreadCount = notifications.filter(n => !n.read).length;
  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectName = activeProject?.name;

  useEffect(() => {
    // Favicon
    const dataUrl = drawFavicon(runningCount, unreadCount);
    updateFaviconLink(dataUrl);

    // Title with state prefix
    const baseTitle = projectName ? `CCK: ${projectName}` : 'Claude Code Kanban';
    let prefix = '';
    if (unreadCount > 0) prefix += `(${unreadCount}) `;
    if (runningCount > 0) prefix += '● ';
    document.title = prefix + baseTitle;
  }, [runningCount, unreadCount, projectName]);
}
