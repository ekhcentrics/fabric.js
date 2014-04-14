fabric.util.object.extend(fabric.IText.prototype, /** @lends fabric.IText.prototype */ {

  /**
   * Initializes hidden textarea (needed to bring up keyboard in iOS)
   */
  initHiddenTextarea: function(x, y) {
		var userAgent = (navigator && navigator.userAgent) ? navigator && navigator.userAgent.toLowerCase() : '',
			looksLikeiPad = userAgent.indexOf('ipad') !== -1,
			looksLikeAndroidChrome = userAgent.indexOf('chrome') !== -1 && userAgent.indexOf('android') !== -1;

    this.hiddenTextarea = fabric.document.createElement('textarea');

    this.hiddenTextarea.setAttribute('autocapitalize', 'off');
    if (!y) {
      y = 0;
    }
    
    if (!fabric.isTouchSupported) {
		//Here we don't care where the text layer is.. just toss it on.
		this.hiddenTextarea.style.cssText = 'position: absolute; top: 0; left: -9999px;';    	
    }
    else {
    	if (looksLikeiPad) {
    		//On an ipad, we can position the text area, and make it transparent, but the cursor remains. For now, just shove it off to the left.
    		this.hiddenTextarea.style.cssText = 'position: absolute; top: ' + y + 'px; left: -9999px;';    	
    	}
		else {
    		//Other places we can try to hide the text area in the correct location; that way the keyboard scrolls the text being editing into view.
			//(works for non-rotated text anyways...)
			this.hiddenTextarea.style.cssText = 'position: absolute; top: ' + y + 'px; left: ' + x + 'px; padding: 0px; border:none; outline:none; cursor:none; resize:none; color:transparent; z-index:-1000; filter:alpha(opacity=0); opacity: 0';
		}
	}
	
        
    fabric.document.body.appendChild(this.hiddenTextarea);


	if (looksLikeAndroidChrome) {
		//EKH
		//Chome on android sucks in one specific way (well, several).
		//NO keypress event in sight. keydown/keyup events - keyCode = 0 sometimes!		
		//https://code.google.com/p/chromium/issues/detail?id=118639
		
		//EKH - for chrome/android; we do not currently get 'keypress', but do the the input event
	    //(at least on Samsumg 10.1 GT-N8013 android 4.1.2 with default keyboard)
		//Going to analyze the before/after text and decide what characters to insert/delete.
		fabric.util.addListener(this.hiddenTextarea, 'keydown', this.onKeyDown.bind(this));
		fabric.util.addListener(this.hiddenTextarea, 'input', this.onChromeAndroidInput.bind(this));
	}
	else {
		fabric.util.addListener(this.hiddenTextarea, 'keydown', this.onKeyDown.bind(this));
		fabric.util.addListener(this.hiddenTextarea, 'keypress', this.onKeyPress.bind(this));
	}

    if (!this._clickHandlerInitialized && this.canvas) {
      fabric.util.addListener(this.canvas.upperCanvasEl, 'click', this.onClick.bind(this));
      this._clickHandlerInitialized = true;
    }
  },

   
    getCharactersToInsert : function (originalText, newText) {
	   
	   var i,j,
		   idxFirstDifference = -1, 
		   idxLastSameOnNew = -1,
		   numSameOnEnd = 0,
		   newCandidate,
		   newOriginal;
		
		if(originalText === newText) {            
			return { text: originalText, selectionStart: this.selectionStart, selectionEnd: this.selectionEnd };			
		}
		else
		{
			//find first difference
			i = 0;
			while(i < originalText.length && i < newText.length) {
				if(originalText.substr(i, 1) !== newText.substr(i, 1)) {
					idxFirstDifference = i;
					break;
				}  
				i = i + 1;
			}
			newOriginal = originalText;
			if(idxFirstDifference === -1) {
				// originalText shorter than newText
				// originalText: AAA
				// newText: AAAB
				if(originalText.length < newText.length) {
					idxFirstDifference = originalText.length;
					newOriginal = '';
				}
				else {
					//newText shorter than originalText
					// newText: AAA
					// originalText: AAAB
					idxFirstDifference = newText.length;
					newOriginal = originalText.substr(newText.length);
				}
			}
			else {
				newOriginal = newOriginal.substr(idxFirstDifference);
			}
			
			newCandidate = newText.substr(idxFirstDifference);
			
			//find last difference
			i = newOriginal.length-1;
			j = newCandidate.length-1;
		   
			numSameOnEnd = 0;
			while(i >= 0 && j >= 0) {
				if(newOriginal.substr(i, 1) === newCandidate.substr(j, 1)) {
					numSameOnEnd = numSameOnEnd + 1;
					idxLastSameOnNew = j;
				}
				else {
					break;
				}
				i = i - 1;
				j = j - 1;
			}
			if (numSameOnEnd === 0) {
				//the two strings are completely different., cursor goes at end..
				return { text: newCandidate, selectionStart: newText.length, selectionEnd: newText.length }  ;  
			}
			else {
				newCandidate = newCandidate.substr(0, idxLastSameOnNew);
				i = idxFirstDifference+newCandidate.length;
				return { text: newCandidate, selectionStart: i, selectionEnd: i }  ;    
			}

		}	
	},
	
	onChromeAndroidInput : function (e) {
		
		var oldText,
			newText,
			toInsert;
		
		if (!this.isEditing ) {
		  return;
		}
		oldText = this.text;
		newText = this.hiddenTextarea.value;
				
		if (oldText !== newText) {
		
			toInsert = this.getCharactersToInsert(oldText, newText);			
			//Debug("-----------------------------------");
			//Debug("old: " + oldText);
			//Debug("new: " + newText);
			//Debug("toInsert: '" + toInsert.text + "' selStart: " + toInsert.selectionStart + " end " + toInsert.selectionEnd);
			//Debug("-----------------------------------");
			if(toInsert.text.length === 0) {
				this.removeChars(e);
			}
			else {
				this.insertChars(toInsert.text);
				this.setSelectionStart(toInsert.selectionStart);
				this.setSelectionEnd(toInsert.selectionEnd);
			}
		}

		e.preventDefault();
		e.stopPropagation();
		
		this.canvas && this.canvas.renderAll();
	},
  

  /**
   * @private
   */
  _keysMap: {
    8:  'removeChars',
    13: 'insertNewline',
    37: 'moveCursorLeft',
    38: 'moveCursorUp',
    39: 'moveCursorRight',
    40: 'moveCursorDown',
    46: 'forwardDelete'
  },

  /**
   * @private
   */
  _ctrlKeysMap: {
    65: 'selectAll',
    67: 'copy',
    86: 'paste',
    88: 'cut'
  },

  onClick: function() {
    // No need to trigger click event here, focus is enough to have the keyboard appear on Android
    this.hiddenTextarea && this.hiddenTextarea.focus();
  },

  /**
   * Handles keyup event
   * @param {Event} e Event object
   */
  onKeyDown: function(e) {
    if (!this.isEditing) return;

    if (e.keyCode in this._keysMap) {
      this[this._keysMap[e.keyCode]](e);
    }
    else if ((e.keyCode in this._ctrlKeysMap) && (e.ctrlKey || e.metaKey)) {
      this[this._ctrlKeysMap[e.keyCode]](e);
    }
    else {
      return;
    }

	//EKH - for android/chrome algorith, I need the carriage return in the textbox, does not appear to break other browsers that I see, may need to be conditional on that particular user agent
	if(e.keyCode !== 13) {
		e.preventDefault();
		e.stopPropagation();
	}


    this.canvas && this.canvas.renderAll();
  },

  /**
   * Forward delete
   */
  forwardDelete: function(e) {
    if (this.selectionStart === this.selectionEnd) {
      this.moveCursorRight(e);
    }
    this.removeChars(e);
  },

  /**
   * Copies selected text
   */
  copy: function() {
    var selectedText = this.getSelectedText();
    this.copiedText = selectedText;
    this.copiedStyles = this.getSelectionStyles(
                          this.selectionStart,
                          this.selectionEnd);
  },

  /**
   * Pastes text
   */
  paste: function() {
    if (this.copiedText) {
      this.insertChars(this.copiedText);
    }
  },

  /**
   * Cuts text
   */
  cut: function(e) {
    this.copy();
    this.removeChars(e);
  },

  /**
   * Handles keypress event
   * @param {Event} e Event object
   */
  onKeyPress: function(e) {
    if (!this.isEditing || e.metaKey || e.ctrlKey || e.keyCode === 8 || e.keyCode === 13) {
      return;
    }

    this.insertChars(String.fromCharCode(e.which));

    e.preventDefault();
    e.stopPropagation();
  },

  /**
   * Gets start offset of a selection
   * @return {Number}
   */
  getDownCursorOffset: function(e, isRight) {

    var selectionProp = isRight ? this.selectionEnd : this.selectionStart,
        textLines = this.text.split(this._reNewline),
        _char,
        lineLeftOffset,

        textBeforeCursor = this.text.slice(0, selectionProp),
        textAfterCursor = this.text.slice(selectionProp),

        textOnSameLineBeforeCursor = textBeforeCursor.slice(textBeforeCursor.lastIndexOf('\n') + 1),
        textOnSameLineAfterCursor = textAfterCursor.match(/(.*)\n?/)[1],
        textOnNextLine = (textAfterCursor.match(/.*\n(.*)\n?/) || { })[1] || '',

        cursorLocation = this.get2DCursorLocation(selectionProp);

    // if on last line, down cursor goes to end of line
    if (cursorLocation.lineIndex === textLines.length - 1 || e.metaKey) {

      // move to the end of a text
      return this.text.length - selectionProp;
    }

    var widthOfSameLineBeforeCursor = this._getWidthOfLine(this.ctx, cursorLocation.lineIndex, textLines);
    lineLeftOffset = this._getLineLeftOffset(widthOfSameLineBeforeCursor);

    var widthOfCharsOnSameLineBeforeCursor = lineLeftOffset,
        lineIndex = cursorLocation.lineIndex;

    for (var i = 0, len = textOnSameLineBeforeCursor.length; i < len; i++) {
      _char = textOnSameLineBeforeCursor[i];
      widthOfCharsOnSameLineBeforeCursor += this._getWidthOfChar(this.ctx, _char, lineIndex, i);
    }

    var indexOnNextLine = this._getIndexOnNextLine(
      cursorLocation, textOnNextLine, widthOfCharsOnSameLineBeforeCursor, textLines);

    return textOnSameLineAfterCursor.length + 1 + indexOnNextLine;
  },

  /**
   * @private
   */
  _getIndexOnNextLine: function(cursorLocation, textOnNextLine, widthOfCharsOnSameLineBeforeCursor, textLines) {

    var lineIndex = cursorLocation.lineIndex + 1,
        widthOfNextLine = this._getWidthOfLine(this.ctx, lineIndex, textLines),
        lineLeftOffset = this._getLineLeftOffset(widthOfNextLine),
        widthOfCharsOnNextLine = lineLeftOffset,
        indexOnNextLine = 0,
        foundMatch;

    for (var j = 0, jlen = textOnNextLine.length; j < jlen; j++) {

      var _char = textOnNextLine[j],
          widthOfChar = this._getWidthOfChar(this.ctx, _char, lineIndex, j);

      widthOfCharsOnNextLine += widthOfChar;

      if (widthOfCharsOnNextLine > widthOfCharsOnSameLineBeforeCursor) {

        foundMatch = true;

        var leftEdge = widthOfCharsOnNextLine - widthOfChar,
            rightEdge = widthOfCharsOnNextLine,
            offsetFromLeftEdge = Math.abs(leftEdge - widthOfCharsOnSameLineBeforeCursor),
            offsetFromRightEdge = Math.abs(rightEdge - widthOfCharsOnSameLineBeforeCursor);

        indexOnNextLine = offsetFromRightEdge < offsetFromLeftEdge ? j + 1 : j;

        break;
      }
    }

    // reached end
    if (!foundMatch) {
      indexOnNextLine = textOnNextLine.length;
    }

    return indexOnNextLine;
  },

  /**
   * Moves cursor down
   * @param {Event} e Event object
   */
  moveCursorDown: function(e) {

    this.abortCursorAnimation();
    this._currentCursorOpacity = 1;

    var offset = this.getDownCursorOffset(e, this._selectionDirection === 'right');

    if (e.shiftKey) {
      this.moveCursorDownWithShift(offset);
    }
    else {
      this.moveCursorDownWithoutShift(offset);
    }

    this.initDelayedCursor();
  },

  /**
   * Moves cursor down without keeping selection
   * @param {Number} offset
   */
  moveCursorDownWithoutShift: function(offset) {

    this._selectionDirection = 'right';
    this.selectionStart += offset;

    if (this.selectionStart > this.text.length) {
      this.selectionStart = this.text.length;
    }
    this.selectionEnd = this.selectionStart;
  },

  /**
   * Moves cursor down while keeping selection
   * @param {Number} offset
   */
  moveCursorDownWithShift: function(offset) {

    if (this._selectionDirection === 'left' && (this.selectionStart !== this.selectionEnd)) {
      this.selectionStart += offset;
      this._selectionDirection = 'left';
      return;
    }
    else {
      this._selectionDirection = 'right';
      this.selectionEnd += offset;

      if (this.selectionEnd > this.text.length) {
        this.selectionEnd = this.text.length;
      }
    }
  },

  getUpCursorOffset: function(e, isRight) {

    var selectionProp = isRight ? this.selectionEnd : this.selectionStart,
        cursorLocation = this.get2DCursorLocation(selectionProp);

    // if on first line, up cursor goes to start of line
    if (cursorLocation.lineIndex === 0 || e.metaKey) {
      return selectionProp;
    }

    var textBeforeCursor = this.text.slice(0, selectionProp),
        textOnSameLineBeforeCursor = textBeforeCursor.slice(textBeforeCursor.lastIndexOf('\n') + 1),
        textOnPreviousLine = (textBeforeCursor.match(/\n?(.*)\n.*$/) || {})[1] || '',
        textLines = this.text.split(this._reNewline),
        _char,
        widthOfSameLineBeforeCursor = this._getWidthOfLine(this.ctx, cursorLocation.lineIndex, textLines),
        lineLeftOffset = this._getLineLeftOffset(widthOfSameLineBeforeCursor),
        widthOfCharsOnSameLineBeforeCursor = lineLeftOffset,
        lineIndex = cursorLocation.lineIndex;

    for (var i = 0, len = textOnSameLineBeforeCursor.length; i < len; i++) {
      _char = textOnSameLineBeforeCursor[i];
      widthOfCharsOnSameLineBeforeCursor += this._getWidthOfChar(this.ctx, _char, lineIndex, i);
    }

    var indexOnPrevLine = this._getIndexOnPrevLine(
      cursorLocation, textOnPreviousLine, widthOfCharsOnSameLineBeforeCursor, textLines);

    return textOnPreviousLine.length - indexOnPrevLine + textOnSameLineBeforeCursor.length;
  },

  /**
   * @private
   */
  _getIndexOnPrevLine: function(cursorLocation, textOnPreviousLine, widthOfCharsOnSameLineBeforeCursor, textLines) {

    var lineIndex = cursorLocation.lineIndex - 1,
        widthOfPreviousLine = this._getWidthOfLine(this.ctx, lineIndex, textLines),
        lineLeftOffset = this._getLineLeftOffset(widthOfPreviousLine),
        widthOfCharsOnPreviousLine = lineLeftOffset,
        indexOnPrevLine = 0,
        foundMatch;

    for (var j = 0, jlen = textOnPreviousLine.length; j < jlen; j++) {

      var _char = textOnPreviousLine[j],
          widthOfChar = this._getWidthOfChar(this.ctx, _char, lineIndex, j);

      widthOfCharsOnPreviousLine += widthOfChar;

      if (widthOfCharsOnPreviousLine > widthOfCharsOnSameLineBeforeCursor) {

        foundMatch = true;

        var leftEdge = widthOfCharsOnPreviousLine - widthOfChar,
            rightEdge = widthOfCharsOnPreviousLine,
            offsetFromLeftEdge = Math.abs(leftEdge - widthOfCharsOnSameLineBeforeCursor),
            offsetFromRightEdge = Math.abs(rightEdge - widthOfCharsOnSameLineBeforeCursor);

        indexOnPrevLine = offsetFromRightEdge < offsetFromLeftEdge ? j : (j - 1);

        break;
      }
    }

    // reached end
    if (!foundMatch) {
      indexOnPrevLine = textOnPreviousLine.length - 1;
    }

    return indexOnPrevLine;
  },

  /**
   * Moves cursor up
   * @param {Event} e Event object
   */
  moveCursorUp: function(e) {

    this.abortCursorAnimation();
    this._currentCursorOpacity = 1;

    var offset = this.getUpCursorOffset(e, this._selectionDirection === 'right');

    if (e.shiftKey) {
      this.moveCursorUpWithShift(offset);
    }
    else {
      this.moveCursorUpWithoutShift(offset);
    }

    this.initDelayedCursor();
  },

  /**
   * Moves cursor up with shift
   * @param {Number} offset
   */
  moveCursorUpWithShift: function(offset) {

    if (this.selectionStart === this.selectionEnd) {
      this.selectionStart -= offset;
    }
    else {
      if (this._selectionDirection === 'right') {
        this.selectionEnd -= offset;
        this._selectionDirection = 'right';
        return;
      }
      else {
        this.selectionStart -= offset;
      }
    }

    if (this.selectionStart < 0) {
      this.selectionStart = 0;
    }

    this._selectionDirection = 'left';
  },

  /**
   * Moves cursor up without shift
   * @param {Number} offset
   */
  moveCursorUpWithoutShift: function(offset) {
    if (this.selectionStart === this.selectionEnd) {
      this.selectionStart -= offset;
    }
    if (this.selectionStart < 0) {
      this.selectionStart = 0;
    }
    this.selectionEnd = this.selectionStart;

    this._selectionDirection = 'left';
  },

  /**
   * Moves cursor left
   * @param {Event} e Event object
   */
  moveCursorLeft: function(e) {
    if (this.selectionStart === 0 && this.selectionEnd === 0) return;

    this.abortCursorAnimation();
    this._currentCursorOpacity = 1;

    if (e.shiftKey) {
      this.moveCursorLeftWithShift(e);
    }
    else {
      this.moveCursorLeftWithoutShift(e);
    }

    this.initDelayedCursor();
  },

  /**
   * @private
   */
  _move: function(e, prop, direction) {
    if (e.altKey) {
      this[prop] = this['findWordBoundary' + direction](this[prop]);
    }
    else if (e.metaKey) {
      this[prop] = this['findLineBoundary' + direction](this[prop]);
    }
    else {
      this[prop] += (direction === 'Left' ? -1 : 1);
    }
  },

  /**
   * @private
   */
  _moveLeft: function(e, prop) {
    this._move(e, prop, 'Left');
  },

  /**
   * @private
   */
  _moveRight: function(e, prop) {
    this._move(e, prop, 'Right');
  },

  /**
   * Moves cursor left without keeping selection
   * @param {Event} e
   */
  moveCursorLeftWithoutShift: function(e) {
    this._selectionDirection = 'left';

    // only move cursor when there is no selection,
    // otherwise we discard it, and leave cursor on same place
    if (this.selectionEnd === this.selectionStart) {
      this._moveLeft(e, 'selectionStart');
    }
    this.selectionEnd = this.selectionStart;
  },

  /**
   * Moves cursor left while keeping selection
   * @param {Event} e
   */
  moveCursorLeftWithShift: function(e) {
    if (this._selectionDirection === 'right' && this.selectionStart !== this.selectionEnd) {
      this._moveLeft(e, 'selectionEnd');
    }
    else {
      this._selectionDirection = 'left';
      this._moveLeft(e, 'selectionStart');

      // increase selection by one if it's a newline
      if (this.text.charAt(this.selectionStart) === '\n') {
        this.selectionStart--;
      }
      if (this.selectionStart < 0) {
        this.selectionStart = 0;
      }
    }
  },

  /**
   * Moves cursor right
   * @param {Event} e Event object
   */
  moveCursorRight: function(e) {
    if (this.selectionStart >= this.text.length && this.selectionEnd >= this.text.length) return;

    this.abortCursorAnimation();
    this._currentCursorOpacity = 1;

    if (e.shiftKey) {
      this.moveCursorRightWithShift(e);
    }
    else {
      this.moveCursorRightWithoutShift(e);
    }

    this.initDelayedCursor();
  },

  /**
   * Moves cursor right while keeping selection
   * @param {Event} e
   */
  moveCursorRightWithShift: function(e) {
    if (this._selectionDirection === 'left' && this.selectionStart !== this.selectionEnd) {
      this._moveRight(e, 'selectionStart');
    }
    else {
      this._selectionDirection = 'right';
      this._moveRight(e, 'selectionEnd');

      // increase selection by one if it's a newline
      if (this.text.charAt(this.selectionEnd - 1) === '\n') {
        this.selectionEnd++;
      }
      if (this.selectionEnd > this.text.length) {
        this.selectionEnd = this.text.length;
      }
    }
  },

  /**
   * Moves cursor right without keeping selection
   * @param {Event} e
   */
  moveCursorRightWithoutShift: function(e) {
    this._selectionDirection = 'right';

    if (this.selectionStart === this.selectionEnd) {
      this._moveRight(e, 'selectionStart');
      this.selectionEnd = this.selectionStart;
    }
    else {
      this.selectionEnd += this.getNumNewLinesInSelectedText();
      if (this.selectionEnd > this.text.length) {
        this.selectionEnd = this.text.length;
      }
      this.selectionStart = this.selectionEnd;
    }
  },

  /**
   * Inserts a character where cursor is (replacing selection if one exists)
   */
  removeChars: function(e) {
    if (this.selectionStart === this.selectionEnd) {
      this._removeCharsNearCursor(e);
    }
    else {
      this._removeCharsFromTo(this.selectionStart, this.selectionEnd);
    }

    this.selectionEnd = this.selectionStart;

    this._removeExtraneousStyles();

    if (this.canvas) {
      // TODO: double renderAll gets rid of text box shift happenning sometimes
      // need to find out what exactly causes it and fix it
      this.canvas.renderAll().renderAll();
    }

    this.setCoords();
    this.fire('changed');
    this.canvas && this.canvas.fire('text:changed', { target: this });
  },

  /**
   * @private
   */
  _removeCharsNearCursor: function(e) {
    if (this.selectionStart !== 0) {

      if (e.metaKey) {
        // remove all till the start of current line
        var leftLineBoundary = this.findLineBoundaryLeft(this.selectionStart);

        this._removeCharsFromTo(leftLineBoundary, this.selectionStart);
        this.selectionStart = leftLineBoundary;
      }
      else if (e.altKey) {
        // remove all till the start of current word
        var leftWordBoundary = this.findWordBoundaryLeft(this.selectionStart);

        this._removeCharsFromTo(leftWordBoundary, this.selectionStart);
        this.selectionStart = leftWordBoundary;
      }
      else {
        var isBeginningOfLine = this.text.slice(this.selectionStart - 1, this.selectionStart) === '\n';
        this.removeStyleObject(isBeginningOfLine);

        this.selectionStart--;
        this.text = this.text.slice(0, this.selectionStart) +
                    this.text.slice(this.selectionStart + 1);
      }
    }
  }
});
