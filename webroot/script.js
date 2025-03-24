/** @typedef {import('../src/message.ts').DevvitSystemMessage} DevvitSystemMessage */
/** @typedef {import('../src/message.ts').WebViewMessage} WebViewMessage */

class App {
  constructor() {
    // Music sequencer state
    this.notes = new Array(32).fill(null).map(() => new Array(13).fill(null));
    this.tempo = 120;
    this.measures = 16;
    this.beatsPerMeasure = 4; // Time signature numerator
    this.isPlaying = false;
    this.currentBeat = 0;
    this.selectedNote = 'piano';
    this.isEraser = false;
    this.scrollPosition = 0;

    // Get references to the HTML elements
    this.grid = document.querySelector('#note-grid');
    this.noteButtons = document.querySelectorAll('.selected-note .note-button');
    this.eraserButton = document.querySelector('#eraser-button');
    this.playButton = document.querySelector('#play-button');
    this.tempoDisplay = document.querySelector('.tempo-display');
    this.measuresDisplay = document.querySelector('.measures-display');
    this.clearButton = document.querySelector('#clear-button');
    this.saveButton = document.querySelector('#save-button');
    this.scrollTrack = document.querySelector('.scroll-track');
    this.scrollThumb = document.querySelector('.scroll-thumb');
    this.timeSignature = document.querySelector('.time-signature select');
    this.measureNumbers = document.querySelector('.measure-numbers');
    this.playbackHead = document.querySelector('.playback-head');
    this.dialogOverlay = document.querySelector('.dialog-overlay');
    this.confirmationDialog = document.querySelector('.confirmation-dialog');
    this.confirmButton = document.querySelector('.confirmation-dialog .confirm-button');
    this.cancelButton = document.querySelector('.confirmation-dialog .cancel-button');

    // Set up audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Instrument configurations
    this.instruments = {
      piano: {
        type: 'sine',
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.1,
        gain: 0.3
      },
      drums: {
        type: 'square',
        attack: 0.01,
        decay: 0.1,
        sustain: 0.1,
        release: 0.1,
        gain: 0.4
      },
      bass: {
        type: 'triangle',
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.2,
        gain: 0.5
      },
      synth: {
        type: 'sawtooth',
        attack: 0.02,
        decay: 0.2,
        sustain: 0.3,
        release: 0.2,
        gain: 0.25
      },
      bell: {
        type: 'sine',
        attack: 0.01,
        decay: 0.3,
        sustain: 0.1,
        release: 0.5,
        gain: 0.2
      },
      flute: {
        type: 'sine',
        attack: 0.05,
        decay: 0.1,
        sustain: 0.8,
        release: 0.3,
        gain: 0.3
      },
      guitar: {
        type: 'triangle',
        attack: 0.02,
        decay: 0.2,
        sustain: 0.4,
        release: 0.3,
        gain: 0.4
      },
      strings: {
        type: 'sine',
        attack: 0.1,
        decay: 0.3,
        sustain: 0.7,
        release: 0.4,
        gain: 0.35
      }
    };

    // Note frequencies (C4 to C5)
    this.frequencies = [
      523.25,  // C5 (higher C)
      493.88,  // B
      466.16,  // A#
      440.00,  // A
      415.30,  // G#
      392.00,  // G
      369.99,  // F#
      349.23,  // F
      329.63,  // E
      311.13,  // D#
      293.66,  // D
      277.18,  // C#
      261.63   // C4 (lower C)
    ];

    // Initialize state
    this.cellWidth = 0;
    this.gridLeft = 40; // Left offset of the grid

    // Initialize the grid and measure the cell width
    this.initializeGrid();
    this.updateMeasureNumbers();
    this.measureCellWidth();
    
    // Event Listeners
    this.playButton.addEventListener('click', () => this.togglePlay());
    
    // Fix clear button event listener
    const clearButton = document.getElementById('clear-button');
    if (clearButton) {
      clearButton.onclick = () => {
        console.log('Clear button clicked'); // Debug log
        this.promptClear();
      };
    }
    
    this.saveButton.addEventListener('click', () => {
      postWebViewMessage({ 
        type: 'createNewPost', 
        data: { 
          notes: this.notes,
          tempo: this.tempo
        } 
      });
    });

    // Note selection
    this.noteButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.selectedNote = button.dataset.note;
        this.isEraser = false;
        this.updateNoteSelection();
        // Play preview note when selecting instrument
        this.playPreviewNote(this.selectedNote);
      });
    });

    // Time signature
    this.timeSignature.addEventListener('change', (e) => {
      this.beatsPerMeasure = parseInt(e.target.value.split('/')[0]);
      this.updateMeasureNumbers();
      this.initializeGrid();
    });

    // Eraser
    this.eraserButton.addEventListener('click', () => {
      this.isEraser = !this.isEraser;
      this.updateNoteSelection();
    });

    // Tempo controls
    document.querySelector('.control-group:nth-child(2) button:first-child').addEventListener('click', () => this.adjustTempo(-5));
    document.querySelector('.control-group:nth-child(2) button:last-child').addEventListener('click', () => this.adjustTempo(5));

    // Measures controls
    document.querySelector('.control-group:nth-child(3) button:first-child').addEventListener('click', () => this.adjustMeasures(-1));
    document.querySelector('.control-group:nth-child(3) button:last-child').addEventListener('click', () => this.adjustMeasures(1));

    // Add drag state
    this.isDragging = false;
    this.lastDraggedCell = null;

    // Add drag event listeners to the grid
    this.grid.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('grid-cell')) {
        this.isDragging = true;
        this.lastDraggedCell = e.target;
        this.toggleNote(e.target);
      }
    });

    this.grid.addEventListener('mousemove', (e) => {
      if (this.isDragging && e.target.classList.contains('grid-cell') && e.target !== this.lastDraggedCell) {
        this.lastDraggedCell = e.target;
        this.toggleNote(e.target);
      }
    });

    // Add global mouseup listener to stop dragging
    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.lastDraggedCell = null;
    });

    // Add global mouseleave listener to stop dragging when mouse leaves the window
    document.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.lastDraggedCell = null;
    });

    // Prevent default drag behavior
    this.grid.addEventListener('dragstart', (e) => e.preventDefault());
    this.grid.addEventListener('drop', (e) => e.preventDefault());
    this.grid.addEventListener('dragover', (e) => e.preventDefault());

    // Scroll functionality
    let isScrolling = false;
    this.scrollThumb.addEventListener('mousedown', () => isScrolling = true);
    document.addEventListener('mousemove', (e) => {
      if (isScrolling) {
        const rect = this.scrollTrack.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.setScrollPosition(Math.max(0, Math.min(1, pos)));
      }
    });
    document.addEventListener('mouseup', () => isScrolling = false);

    // Initialize displays
    this.updateTempoDisplay();
    this.updateMeasuresDisplay();

    // Message handling
    addEventListener('message', this.#onMessage);
    addEventListener('load', () => {
      postWebViewMessage({ type: 'webViewReady' });
    });
  }

  measureCellWidth() {
    const cell = this.grid.querySelector('.grid-cell');
    if (cell) {
      this.cellWidth = cell.offsetWidth;
    }
  }

  updateMeasureNumbers() {
    this.measureNumbers.innerHTML = '';
    const totalBeats = this.measures * this.beatsPerMeasure;
    const startBeat = Math.floor(this.scrollPosition * (totalBeats - 16));
    const startMeasure = Math.floor(startBeat / this.beatsPerMeasure);
    
    // Create measure numbers for visible measures
    for (let i = 0; i < Math.ceil(16 / this.beatsPerMeasure); i++) {
      const measureNum = startMeasure + i + 1;
      if (measureNum <= this.measures) {
        const div = document.createElement('div');
        div.className = 'measure-number';
        div.textContent = measureNum.toString();
        div.style.width = `${this.beatsPerMeasure * 100 / 16}%`;
        this.measureNumbers.appendChild(div);
      }
    }
  }

  initializeGrid() {
    this.grid.innerHTML = '';
    const totalBeats = this.measures * this.beatsPerMeasure;
    const startBeat = Math.floor(this.scrollPosition * (totalBeats - 16));
    
    // Update grid template
    this.grid.style.gridTemplateColumns = `repeat(16, 1fr)`;
    
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 16; col++) {
        const actualCol = startBeat + col;
        if (actualCol >= totalBeats) continue;
        
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        
        // Add measure line styling
        if ((actualCol % this.beatsPerMeasure) === 0) {
          cell.style.borderLeft = '2px solid #ccc';
        } else {
          cell.style.borderLeft = '1px solid #eee';
        }
        
        cell.dataset.row = row;
        cell.dataset.col = actualCol;
        
        if (this.notes[actualCol] && this.notes[actualCol][row] !== null && this.notes[actualCol][row] !== undefined) {
          cell.classList.add('active');
          const img = document.createElement('img');
          img.src = `icons/icon${this.getInstrumentNumber(this.notes[actualCol][row])}.png`;
          img.alt = this.notes[actualCol][row];
          cell.appendChild(img);
        }
        
        this.grid.appendChild(cell);
      }
    }
    
    // Update cell width measurement after grid is initialized
    this.measureCellWidth();

    // Update scroll bar visibility and position
    const visibleBeats = 16;
    const thumbWidth = Math.min(100, (visibleBeats / totalBeats) * 100);
    this.scrollThumb.style.width = `${thumbWidth}%`;
    this.scrollThumb.style.left = `${this.scrollPosition * (100 - thumbWidth)}%`;
    
    // Show/hide scroll bar based on content width
    const scrollContainer = document.querySelector('.scroll-container');
    if (totalBeats > visibleBeats) {
      scrollContainer.style.display = 'block';
    } else {
      scrollContainer.style.display = 'none';
    }
  }

  getInstrumentNumber(instrument) {
    const instrumentMap = {
      'piano': 1,
      'drums': 2,
      'bass': 3,
      'synth': 4,
      'bell': 5,
      'flute': 6,
      'guitar': 7,
      'strings': 8
    };
    return instrumentMap[instrument];
  }

  setScrollPosition(pos) {
    this.scrollPosition = pos;
    const totalBeats = this.measures * this.beatsPerMeasure;
    const visibleBeats = 16;
    const maxScroll = Math.max(0, totalBeats - visibleBeats);
    const thumbWidth = Math.min(100, (visibleBeats / totalBeats) * 100);
    
    this.scrollThumb.style.width = `${thumbWidth}%`;
    this.scrollThumb.style.left = `${pos * (100 - thumbWidth)}%`;
    
    this.initializeGrid();
    this.updateMeasureNumbers();
  }

  toggleNote(cell) {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    if (this.isEraser) {
      this.notes[col][row] = null;
    } else {
      this.notes[col][row] = this.selectedNote;
      // Play the note when placing it
      this.playNote(row, col);
    }
    this.initializeGrid();
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    this.playButton.textContent = this.isPlaying ? 'Stop' : 'Play';
    this.playButton.classList.toggle('primary');
    
    if (this.isPlaying) {
      // Resume or start audio context (needed due to browser autoplay policies)
      this.audioContext.resume();
      this.currentBeat = -1; // Start at -1 so first beat (0) plays
      this.startTime = this.audioContext.currentTime;
      this.playbackHead.style.display = 'block';
      this.playSequence();
    } else {
      this.currentBeat = 0;
      this.playbackHead.style.display = 'none';
    }
  }

  async playSequence() {
    const beatDuration = 60 / this.tempo; // Convert BPM to seconds per beat
    const totalBeats = this.measures * this.beatsPerMeasure;
    
    while (this.isPlaying) {
      const now = this.audioContext.currentTime;
      const elapsedTime = now - this.startTime;
      const beatPosition = elapsedTime / beatDuration;
      const currentBeat = Math.floor(beatPosition);
      
      // Check if we need to play the next beat
      if (currentBeat > this.currentBeat) {
        const normalizedBeat = currentBeat % totalBeats;
        // Play all notes for this beat
        this.playBeat(normalizedBeat);
        this.currentBeat = currentBeat;
        
        // Handle auto-scrolling
        const visibleBeats = 16;
        if (normalizedBeat % visibleBeats === 0 && normalizedBeat > 0) {
          const newScrollPos = Math.min(1, (normalizedBeat / totalBeats));
          this.setScrollPosition(newScrollPos);
        }
        
        // Reset to beginning if we've reached the end
        if (normalizedBeat === 0 && currentBeat > 0) {
          this.setScrollPosition(0);
        }
      }
      
      // Update playback head with smooth movement
      const normalizedPosition = beatPosition % totalBeats;
      this.updatePlaybackHead(normalizedPosition);
      
      // Use a shorter delay for smoother animation
      await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
    }
    
    this.playbackHead.style.display = 'none';
  }

  updatePlaybackHead(beatPosition) {
    const visibleBeats = 16;
    const totalBeats = this.measures * this.beatsPerMeasure;
    const startBeat = Math.floor(this.scrollPosition * (totalBeats - visibleBeats));
    const currentVisibleBeat = beatPosition - startBeat;
    
    // Only show playhead when the current beat is in view
    if (currentVisibleBeat >= 0 && currentVisibleBeat < visibleBeats) {
      this.playbackHead.style.display = 'block';
      const pixelPosition = this.gridLeft + (currentVisibleBeat * this.cellWidth);
      this.playbackHead.style.left = `${pixelPosition}px`;
    } else {
      this.playbackHead.style.display = 'none';
    }
  }

  playBeat(beat) {
    // Ensure beat is within bounds
    if (beat < 0 || beat >= this.measures * this.beatsPerMeasure) return;
    
    // Play all notes for this beat
    for (let row = 0; row < 13; row++) {
      if (this.notes[beat] && this.notes[beat][row] !== null && this.notes[beat][row] !== undefined) {
        this.playNote(row, beat);
      }
    }
  }

  playNote(noteIndex, beat) {
    const frequency = this.frequencies[noteIndex];
    const instrument = this.instruments[this.notes[beat][noteIndex]];
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = instrument.type;
    oscillator.frequency.value = frequency;
    
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(instrument.gain, now + instrument.attack);
    gainNode.gain.linearRampToValueAtTime(instrument.gain * instrument.sustain, now + instrument.attack + instrument.decay);
    gainNode.gain.linearRampToValueAtTime(0, now + instrument.attack + instrument.decay + instrument.release);
    
    oscillator.start(now);
    oscillator.stop(now + instrument.attack + instrument.decay + instrument.release);
    
    // Ensure audio context is running (needed for browsers' autoplay policies)
    this.audioContext.resume();
  }

  adjustTempo(delta) {
    this.tempo = Math.max(60, Math.min(240, this.tempo + delta));
    this.updateTempoDisplay();
  }

  adjustMeasures(delta) {
    const newMeasures = Math.max(1, Math.min(32, this.measures + delta));
    if (newMeasures !== this.measures) {
      this.measures = newMeasures;
      this.updateMeasuresDisplay();
      this.setScrollPosition(0); // Reset scroll when measure count changes
    }
  }

  updateTempoDisplay() {
    this.tempoDisplay.textContent = `${this.tempo} BPM`;
  }

  updateMeasuresDisplay() {
    this.measuresDisplay.textContent = `${this.measures} measures`;
  }

  updateNoteSelection() {
    this.noteButtons.forEach(button => {
      button.classList.toggle('active', !this.isEraser && button.dataset.note === this.selectedNote);
    });
    this.eraserButton.classList.toggle('active', this.isEraser);
  }

  promptClear() {
    console.log('Prompting clear'); // Debug log
    
    // Show the dialog and overlay
    this.dialogOverlay.classList.add('show');
    this.confirmationDialog.classList.add('show');
    
    // Set up event listeners for the buttons
    const handleConfirm = () => {
      console.log('Clear confirmed'); // Debug log
      // Stop playback if playing
      if (this.isPlaying) {
        this.togglePlay();
      }
      
      // Create a new array with the correct size and initialize all elements to null
      const totalBeats = this.measures * this.beatsPerMeasure;
      this.notes = Array(totalBeats).fill(null).map(() => Array(13).fill(null));
      
      // Reset scroll position
      this.scrollPosition = 0;
      
      // Update the grid and measure numbers
      this.initializeGrid();
      this.updateMeasureNumbers();
      
      // Reset playback head
      this.playbackHead.style.display = 'none';
      this.currentBeat = 0;
      
      // Force a redraw of the grid
      this.grid.innerHTML = '';
      this.initializeGrid();
      
      console.log('Grid cleared'); // Debug log
      
      // Hide the dialog and overlay
      this.dialogOverlay.classList.remove('show');
      this.confirmationDialog.classList.remove('show');
      
      // Remove event listeners
      this.confirmButton.removeEventListener('click', handleConfirm);
      this.cancelButton.removeEventListener('click', handleCancel);
    };
    
    const handleCancel = () => {
      // Hide the dialog and overlay
      this.dialogOverlay.classList.remove('show');
      this.confirmationDialog.classList.remove('show');
      
      // Remove event listeners
      this.confirmButton.removeEventListener('click', handleConfirm);
      this.cancelButton.removeEventListener('click', handleCancel);
    };
    
    // Add event listeners
    this.confirmButton.addEventListener('click', handleConfirm);
    this.cancelButton.addEventListener('click', handleCancel);
  }

  playPreviewNote(instrumentName) {
    // Play middle C (C4) as preview
    const frequency = this.frequencies[0];
    const instrument = this.instruments[instrumentName];
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = instrument.type;
    oscillator.frequency.value = frequency;
    
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(instrument.gain, now + instrument.attack);
    gainNode.gain.linearRampToValueAtTime(instrument.gain * instrument.sustain, now + instrument.attack + instrument.decay);
    gainNode.gain.linearRampToValueAtTime(0, now + instrument.attack + instrument.decay + instrument.release);
    
    oscillator.start(now);
    oscillator.stop(now + instrument.attack + instrument.decay + instrument.release);
    
    // Ensure audio context is running (needed for browsers' autoplay policies)
    this.audioContext.resume();
  }

  /**
   * @arg {MessageEvent<DevvitSystemMessage>} ev
   * @return {void}
   */
  #onMessage = (ev) => {
    if (ev.data.type !== 'devvit-message') return;
    const { message } = ev.data.data;

    switch (message.type) {
      case 'initialData': {
        const { notes, tempo } = message.data;
        if (notes) {
          this.notes = notes;
          this.initializeGrid();
        }
        if (tempo) {
          this.tempo = tempo;
          this.updateTempoDisplay();
        }
        break;
      }
      default:
        const _ = message;
        break;
    }
  };
}

/**
 * Sends a message to the Devvit app.
 * @arg {WebViewMessage} msg
 * @return {void}
 */
function postWebViewMessage(msg) {
  parent.postMessage(msg, '*');
}

new App();
