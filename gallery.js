const grid = document.querySelector('.scene-grid');
for (const [id, scene] of Object.entries(studies)) {
  const link = document.createElement('a');
  link.className = 'scene-card';
  link.href = 'study.html?scene=' + id;
  const preview = document.createElement('img');
  preview.src = 'previews/' + id + '-cover.webp';
  preview.alt = '';
  preview.width = 900;
  preview.height = 506;
  const title = document.createElement('h2');
  title.textContent = scene.name;
  const description = document.createElement('p');
  description.textContent = scene.subject;
  link.append(preview, title, description);
  grid.append(link);
}
