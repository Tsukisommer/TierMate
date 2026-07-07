document.addEventListener('DOMContentLoaded', () => {
    const tierBoard = document.getElementById('tier-board');
    const addTierBtn = document.getElementById('add-tier-btn');
    const saveImageBtn = document.getElementById('save-image-btn');
    const resetBoardBtn = document.getElementById('reset-board-btn');
    const imageUpload = document.getElementById('image-upload');
    const inventoryBox = document.getElementById('inventory-box');
    
    const saveProjectBtn = document.getElementById('save-project-btn');
    const loadProjectInput = document.getElementById('load-project-input');
    
    const searchInput = document.getElementById('api-search-input');
    const searchBtn = document.getElementById('api-search-btn');
    const searchType = document.getElementById('api-search-type');
    const searchResultsContainer = document.getElementById('search-results-container');

    let draggedImageWrapper = null;
    let draggedRow = null;

    let currentContextMenu = null;

    document.addEventListener('click', () => {
        if (currentContextMenu) {
            currentContextMenu.style.display = 'none';
        }
    });

    function saveBoardState() {
        try {
            const tiers = [];
            document.querySelectorAll('.tier-row').forEach(row => {
                const name = row.querySelector('.tier-text').innerText;
                const color = row.querySelector('.tier-color-picker').value;
                const images = [];
                row.querySelectorAll('.dropzone .tier-item-wrapper').forEach(wrapper => {
                    const imgSrc = wrapper.querySelector('.tier-item').src;
                    const captionText = wrapper.querySelector('.tier-item-caption').innerText;
                    images.push({ src: imgSrc, caption: captionText });
                });
                tiers.push({ name, color, images });
            });

            const inventoryImages = [];
            document.querySelectorAll('#inventory-box .tier-item-wrapper').forEach(wrapper => {
                const imgSrc = wrapper.querySelector('.tier-item').src;
                const captionText = wrapper.querySelector('.tier-item-caption').innerText;
                inventoryImages.push({ src: imgSrc, caption: captionText });
            });

            const state = { tiers, inventoryImages };
            localStorage.setItem('tierMateState', JSON.stringify(state));
        } catch (e) {
            console.warn("Could not save to localStorage", e);
        }
    }

    function loadBoardState() {
        const savedState = localStorage.getItem('tierMateState');
        if (savedState) {
            const state = JSON.parse(savedState);
            state.tiers.forEach(tier => createTierRow(tier.name, tier.color, tier.images));
            
            if (state.inventoryImages) {
                state.inventoryImages.forEach(data => {
                    const src = data.src || data; 
                    const caption = data.caption || "";
                    createAndAppendImage(src, inventoryBox, caption);
                });
            }
            return true;
        }
        return false; 
    }

    if (!loadBoardState()) {
        const defaultTiers = [
            { name: 'Absolute Cinema', color: '#ff7f7f' },
            { name: 'It\'s Peak', color: '#ffbf7f' },
            { name: 'Good Stuff', color: '#ffff7f' },
            { name: 'Mid', color: '#66d466' },
            { name: 'Bad', color: '#947349' },
            { name: 'Absolute Garbage', color: '#c5c2b0' }
        ];
        defaultTiers.forEach(tier => createTierRow(tier.name, tier.color));
    }

    function createTierRow(name, colorHex, savedImageDataArray = []) {
        const row = document.createElement('div');
        row.className = 'tier-row';

        const labelContainer = document.createElement('div');
        labelContainer.className = 'tier-label-container';
        labelContainer.style.backgroundColor = colorHex;

        const colorPickerWrapper = document.createElement('div');
        colorPickerWrapper.className = 'color-picker-wrapper';
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.className = 'tier-color-picker';
        colorPicker.value = colorHex;
        colorPicker.addEventListener('input', (e) => {
            labelContainer.style.backgroundColor = e.target.value;
            saveBoardState(); 
        });
        colorPickerWrapper.appendChild(colorPicker);
        labelContainer.appendChild(colorPickerWrapper);

        const dragHandleWrapper = document.createElement('div');
        dragHandleWrapper.className = 'drag-handle-wrapper';
        dragHandleWrapper.innerHTML = '<i class="fa-solid fa-grip"></i>'; 
        dragHandleWrapper.addEventListener('mousedown', () => row.draggable = true);
        dragHandleWrapper.addEventListener('mouseup', () => row.draggable = false);
        dragHandleWrapper.addEventListener('mouseleave', () => row.draggable = false);
        labelContainer.appendChild(dragHandleWrapper);

        const textEdit = document.createElement('div');
        textEdit.className = 'tier-text';
        textEdit.contentEditable = true;
        textEdit.innerText = name;
        textEdit.addEventListener('blur', saveBoardState); 
        labelContainer.appendChild(textEdit);

        const deleteIconWrapper = document.createElement('div');
        deleteIconWrapper.className = 'delete-icon-wrapper';
        deleteIconWrapper.innerHTML = '<i class="fa fa-trash"></i>';
        deleteIconWrapper.addEventListener('click', () => {
            row.remove();
            saveBoardState(); 
        });
        labelContainer.appendChild(deleteIconWrapper);

        const dropzone = document.createElement('div');
        dropzone.className = 'dropzone';
        setupDropzone(dropzone);

        savedImageDataArray.forEach(data => {
            const src = data.src || data; 
            const caption = data.caption || "";
            createAndAppendImage(src, dropzone, caption);
        });

        row.appendChild(labelContainer);
        row.appendChild(dropzone);
        tierBoard.appendChild(row);

        setupRowReordering(row); 
        saveBoardState(); 
    }

    addTierBtn.addEventListener('click', () => {
        createTierRow('New Tier', '#cccccc');
    });

    resetBoardBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to wipe your save and start over?")) {
            localStorage.removeItem('tierMateState');
            location.reload(); 
        }
    });

    saveProjectBtn.addEventListener('click', () => {
        saveBoardState(); 
        const savedState = localStorage.getItem('tierMateState');
        if (!savedState) return;

        const blob = new Blob([savedState], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        const date = new Date().toISOString().split('T')[0];
        a.download = `TierMate_Project_${date}.json`;
        
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });

    loadProjectInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedState = JSON.parse(e.target.result);
                
                if (!importedState.tiers || !Array.isArray(importedState.tiers)) {
                    alert("This doesn't look like a valid TierMate project file.");
                    return;
                }

                if(confirm("Loading this project will overwrite your current board. Continue?")) {
                    localStorage.setItem('tierMateState', JSON.stringify(importedState));
                    
                    tierBoard.innerHTML = '';
                    inventoryBox.innerHTML = '';
                    
                    importedState.tiers.forEach(tier => createTierRow(tier.name, tier.color, tier.images));
                    
                    if (importedState.inventoryImages) {
                        importedState.inventoryImages.forEach(data => {
                            const src = data.src || data; 
                            const caption = data.caption || "";
                            createAndAppendImage(src, inventoryBox, caption);
                        });
                    }
                }
            } catch (err) {
                alert("Error reading file. Make sure it's a valid JSON project file.");
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    });

    function createContextMenuTemplate() {
        const template = document.getElementById('context-menu-template');
        return template.content.querySelector('.context-menu').cloneNode(true);
    }

    function createAndAppendImage(src, container, initialCaptionText = "") {
        const wrapper = document.createElement('div');
        wrapper.className = 'tier-item-wrapper';
        wrapper.draggable = true;

        const imageContainer = document.createElement('div');
        imageContainer.className = 'tier-item-image-container';

        const img = document.createElement('img');
        img.src = src;
        img.className = 'tier-item';
        imageContainer.appendChild(img);
        wrapper.appendChild(imageContainer);

        const trashCan = document.createElement('div');
        trashCan.className = 'remove-btn-trash';
        trashCan.innerHTML = '<i class="fa fa-trash"></i>';
        trashCan.addEventListener('click', (e) => {
            e.stopPropagation(); 
            wrapper.remove();
            saveBoardState(); 
        });
        imageContainer.appendChild(trashCan);

        const caption = document.createElement('div');
        caption.className = 'tier-item-caption';
        caption.contentEditable = true;
        caption.innerText = initialCaptionText;
        wrapper.appendChild(caption);

        caption.addEventListener('blur', saveBoardState); 

        wrapper.addEventListener('dragstart', () => {
            draggedImageWrapper = wrapper;
            setTimeout(() => wrapper.style.display = 'none', 0);
        });

        wrapper.addEventListener('dragend', () => {
            setTimeout(() => {
                draggedImageWrapper.style.display = 'inline-block'; 
                draggedImageWrapper = null;
                saveBoardState(); 
            }, 0);
        });

        wrapper.addEventListener('contextmenu', (e) => {
            if (inventoryBox.contains(wrapper)) return; 
            e.preventDefault(); 

            if (currentContextMenu) currentContextMenu.remove();

            const menu = createContextMenuTemplate();
            currentContextMenu = menu;
            document.body.appendChild(menu);

            const rect = wrapper.getBoundingClientRect();
            const top = rect.top + window.scrollY + (rect.height / 2);
            const left = rect.left + window.scrollX + (rect.width / 2);

            menu.style.top = top + 'px';
            menu.style.left = left + 'px';
            menu.style.transform = 'translate(-50%, -50%)';
            menu.style.display = 'block';

            const removeBtn = menu.querySelector('.remove-image-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation(); 
                    wrapper.remove();
                    menu.remove();
                    saveBoardState();
                });
            }

            const downloadBtn = menu.querySelector('.download-image-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    
                    const imgSrc = wrapper.querySelector('.tier-item').src;
                    const captionText = wrapper.querySelector('.tier-item-caption').innerText.trim();
                    const safeName = captionText ? captionText.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'tier_item';

                    try {
                        const response = await fetch(imgSrc);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = safeName + '.jpg';
                        document.body.appendChild(a);
                        a.click();
                        
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    } catch (error) {
                        const a = document.createElement('a');
                        a.href = imgSrc;
                        a.download = safeName;
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }
                    menu.remove();
                });
            }
        });

        container.appendChild(wrapper);
        saveBoardState(); 
    }

    imageUpload.addEventListener('change', (event) => {
        const files = event.target.files;
        for (let file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                createAndAppendImage(e.target.result, inventoryBox, "");
            };
            reader.readAsDataURL(file);
        }
    });

    function setupDropzone(zone) {
        zone.addEventListener('dragover', (e) => e.preventDefault());
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedImageWrapper) {
                zone.appendChild(draggedImageWrapper);
            }
        });
    }

    setupDropzone(inventoryBox);
    setupDropzone(document.querySelector('.footer-credit'));
    document.querySelector('.footer-credit').addEventListener('drop', (e) => {
        if(draggedImageWrapper) {
            draggedImageWrapper.remove();
            saveBoardState(); 
        }
    });

    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        const type = searchType.value;
        if (!query) return;

        searchBtn.disabled = true;
        searchResultsContainer.innerHTML = '<span style="font-size:14px; color:#aaa; margin-top:5px;">Searching...</span>';

        try {
            let results = [];
            
            if (type === 'shows') {
                const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                results = data.map(item => ({ 
                    src: item.show.image?.medium, 
                    title: item.show.name 
                })).filter(item => item.src);
            } 
            else if (type === 'anime') {
                const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=10`);
                const data = await res.json();
                results = data.data.map(item => ({ 
                    src: item.images?.jpg?.image_url, 
                    title: item.title 
                })).filter(item => item.src);
            }
            else if (type === 'movies') {
                const res = await fetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                let items = data.description || data.d || [];
                results = items.map(item => ({ 
                    src: item['#IMG_POSTER'] || item.i?.imageUrl, 
                    title: item['#TITLE'] || item.l 
                })).filter(item => item.src);
            }
            else if (type === 'games') {
                const res = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(query)}&limit=10`);
                const data = await res.json();
                results = data.map(item => ({ 
                    src: item.thumb, 
                    title: item.external 
                })).filter(item => item.src);
            }

            searchResultsContainer.innerHTML = ''; 

            if (results.length === 0) {
                searchResultsContainer.innerHTML = '<span style="font-size:14px; color:#aaa; margin-top:5px;">No results found.</span>';
            } else {
                results.slice(0, 10).forEach(item => {
                    const img = document.createElement('img');
                    img.src = item.src;
                    img.className = 'search-result-item';
                    img.title = item.title; 
                    
                    img.addEventListener('click', () => {
                        createAndAppendImage(item.src, inventoryBox, item.title);
                        img.style.borderColor = '#4CAF50';
                        setTimeout(() => img.style.borderColor = 'transparent', 300);
                    });
                    searchResultsContainer.appendChild(img);
                });
            }
        } catch (error) {
            searchResultsContainer.innerHTML = '<span style="font-size:14px; color:#f44; margin-top:5px;">Error searching. Check connection.</span>';
        }
        
        searchBtn.disabled = false;
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });

    function setupRowReordering(row) {
        row.addEventListener('dragstart', (e) => {
            if(e.target !== row) return; 
            draggedRow = row;
            row.classList.add('dragging');
        });

        row.addEventListener('dragend', () => {
            draggedRow = null;
            row.classList.remove('dragging'); 
            row.draggable = false; 
            saveBoardState(); 
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            const overRow = e.target.closest('.tier-row');
            if (overRow && draggedRow && overRow !== draggedRow) {
                overRow.classList.add('drag-over');
            }
        });

        row.addEventListener('dragleave', (e) => {
            const leaveRow = e.target.closest('.tier-row');
            if (leaveRow && leaveRow !== draggedRow) {
                leaveRow.classList.remove('drag-over');
            }
        });

        row.addEventListener('drop', (e) => {
            e.preventDefault();
            const droppedOnRow = e.target.closest('.tier-row');
            if (droppedOnRow && draggedRow && droppedOnRow !== draggedRow) {
                droppedOnRow.classList.remove('drag-over');
                const bounding = droppedOnRow.getBoundingClientRect();
                const offset = bounding.y + bounding.height / 2;
                if (e.clientY - offset > 0) {
                    tierBoard.insertBefore(draggedRow, droppedOnRow.nextSibling);
                } else {
                    tierBoard.insertBefore(draggedRow, droppedOnRow);
                }
            }
        });
    }

    saveImageBtn.addEventListener('click', () => {
        tierBoard.classList.add('exporting');
        setTimeout(() => {
            const scale = 3; 
            domtoimage.toPng(tierBoard, { 
                bgcolor: '#121212', 
                width: tierBoard.scrollWidth * scale,
                height: tierBoard.scrollHeight * scale,
                style: {
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: tierBoard.scrollWidth + "px",
                    height: tierBoard.scrollHeight + "px"
                }
            })
            .then(function (dataUrl) {
                tierBoard.classList.remove('exporting');
                const link = document.createElement('a');
                link.download = 'My_Custom_Tier_List.png';
                link.href = dataUrl;
                link.click();
            })
            .catch(function (error) {
                console.error('Export failed:', error);
                tierBoard.classList.remove('exporting'); 
                alert("Something went wrong saving the high-res image. Check the console.");
            });
        }, 150); 
    });

    // --- RANDOMIZER WHEEL LOGIC ---
    const randomizerBtn = document.getElementById('randomizer-btn');
    const wheelModal = document.getElementById('wheel-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const spinBtn = document.getElementById('spin-btn');
    const wheelCanvas = document.getElementById('wheel-canvas');
    const wheelResult = document.getElementById('wheel-result');
    const ctx = wheelCanvas.getContext('2d');

    let wheelItems = [];
    let currentAngle = 0;
    let isSpinning = false;
    let spinTimeout = null;
    let spinStart = null;
    let startAngle = 0;
    let spinTotalAngle = 0;
    const spinTimeTotal = 4000; // 4 seconds of spin

    // Material design inspired colors for the wheel
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

    randomizerBtn.addEventListener('click', () => {
        // Grab only items currently in the inventory box that have a caption typed in
        const captions = Array.from(document.querySelectorAll('#inventory-box .tier-item-caption'))
            .map(el => el.innerText.trim())
            .filter(text => text.length > 0);

        if (captions.length === 0) {
            alert("Oops! Add some items to the inventory first and make sure they have names underneath them!");
            return;
        }

        wheelItems = captions;
        currentAngle = 0;
        wheelResult.innerText = '';
        drawWheel();
        wheelModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        if(!isSpinning) wheelModal.style.display = 'none';
    });

    function drawWheel() {
        const numItems = wheelItems.length;
        const arcSize = (2 * Math.PI) / numItems;
        const radius = wheelCanvas.width / 2;
        const centerX = radius;
        const centerY = radius;

        ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

        for (let i = 0; i < numItems; i++) {
            const angle = currentAngle + i * arcSize;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, angle, angle + arcSize, false);
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();
            ctx.save();

            // Text Setup
            ctx.fillStyle = "white";
            ctx.translate(centerX, centerY);
            ctx.rotate(angle + arcSize / 2);
            ctx.textAlign = "right";
            ctx.font = "bold 16px 'Segoe UI'";
            
            // Truncate long titles so they fit on the wheel slice
            let text = wheelItems[i];
            if(text.length > 18) text = text.substring(0, 15) + '...';
            
            ctx.fillText(text, radius - 15, 6);
            ctx.restore();
        }
    }

    spinBtn.addEventListener('click', () => {
        if (isSpinning || wheelItems.length === 0) return;
        isSpinning = true;
        wheelResult.innerText = 'Spinning...';

        startAngle = currentAngle;
        // Spin between 4 to 8 full rotations plus a random offset
        spinTotalAngle = (Math.random() * 4 + 4) * Math.PI * 2 + (Math.random() * Math.PI * 2);
        spinStart = null; // Reset timestamp
        
        requestAnimationFrame(rotateWheel);
    });

    function rotateWheel(timestamp) {
        if (!spinStart) spinStart = timestamp;
        let progress = timestamp - spinStart;

        if (progress >= spinTimeTotal) {
            currentAngle = startAngle + spinTotalAngle;
            drawWheel();
            stopRotateWheel();
            return;
        }

        // Quartic ease-out function for smooth deceleration
        let t = progress / spinTimeTotal;
        t--;
        let easedProgress = -(t * t * t * t - 1);

        currentAngle = startAngle + (spinTotalAngle * easedProgress);
        drawWheel();
        spinTimeout = requestAnimationFrame(rotateWheel);
    }

    function stopRotateWheel() {
        isSpinning = false;
        const numItems = wheelItems.length;
        
        // Calculate which item is currently under the pointer (at 270 degrees / the top)
        const degrees = (currentAngle * 180 / Math.PI) % 360;
        const index = Math.floor(((360 - degrees + 270) % 360) / (360 / numItems));
        
        wheelResult.innerText = '🎉 ' + wheelItems[index] + ' 🎉';
        
        // Confetti effect or anything else could go here in the future
    }
});
