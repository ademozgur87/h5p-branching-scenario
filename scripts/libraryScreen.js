H5P.BranchingScenario.LibraryScreen = (function() {

  function LibraryScreen(parent, courseTitle, library) {
    this.parent = parent;
    this.currentLibrary;
    this.currentLibraryElement;
    this.currentLibraryInstance;
    this.nextLibraryId = library.nextContentId;
    this.nextLibraries = {};
    this.libraryInstances = {};
    this.libraryTitle;
    this.branchingQuestions = [];

    this.wrapper = library.showContentTitle ? this.createWrapper(courseTitle, library.contentTitle) : this.createWrapper(courseTitle);
    this.wrapper.classList.add('h5p-next-screen');

    var libraryWrapper = this.createLibraryElement(library, false);
    this.currentLibrary = libraryWrapper;
    this.currentLibraryElement = libraryWrapper.getElementsByClassName('h5p-branching-scenario-content')[0];
    this.currentLibraryInstance = this.libraryInstances[0]; // TODO: do not hardcode starting screen id

    this.createNextLibraries(library);

    this.wrapper.append(libraryWrapper);
  }

  LibraryScreen.prototype.createWrapper = function(courseTitle, libraryTitle) {
    var wrapper = document.createElement('div');

    var titleDiv = document.createElement('div');
    titleDiv.classList.add('h5p-title-wrapper');

    var headerTitle = document.createElement('h1');
    headerTitle.innerHTML = courseTitle;
    titleDiv.append(headerTitle);

    var headerSubtitle = document.createElement('h2');
    headerSubtitle.classList = 'library-subtitle';
    headerSubtitle.innerHTML = libraryTitle ? libraryTitle : '';
    titleDiv.append(headerSubtitle);

    this.libraryTitle = headerSubtitle;

    var buttonWrapper = document.createElement('div');
    buttonWrapper.classList.add('h5p-nav-button-wrapper');
    var navButton = document.createElement('button');

    var self = this;
    var parent = this.parent;
    navButton.onclick = function() {
      parent.trigger('navigated', self.nextLibraryId);
    };
    navButton.classList.add('h5p-nav-button');

    navButton.append(document.createTextNode(parent.params.proceedButtonText));
    buttonWrapper.append(navButton);

    var header = document.createElement('div');
    header.classList.add('h5p-screen-header');

    header.append(titleDiv);
    header.append(buttonWrapper);
    wrapper.append(header);

    // Resize container on animation end
    wrapper.addEventListener("animationend", function(event) {
      if (event.animationName === 'slide-in' && self.currentLibraryElement) {
        // Resize, TODO: Remove hardcoded padding
        setTimeout(function() {
          self.currentLibrary.style.height = self.currentLibraryElement.clientHeight + 20 + 'px';
          parent.trigger('resize');
        }, 800);
      }
    });

    return wrapper;
  };

  LibraryScreen.prototype.createLibraryElement = function (library, isNextLibrary) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('h5p-library-wrapper');

    if (isNextLibrary) {
      wrapper.classList.add('h5p-next');
    }

    var libraryElement = document.createElement('div');
    libraryElement.classList.add('h5p-branching-scenario-content');

    this.appendRunnable(libraryElement, library.content, library.contentId);

    wrapper.append(libraryElement);
    return wrapper;
  };

  LibraryScreen.prototype.appendRunnable = function(container, content, id, contentData) {
    var parent = this.parent;
    
    var library = content.library.split(' ')[0];
    if (library === 'H5P.Video') {
      // Prevent video from growing endlessly since height is unlimited.
      content.params.visuals.fit = false;
    }
    if (library === 'H5P.BranchingQuestion') {
      content.params.proceedButtonText = parent.params.proceedButtonText;
    }

    // Create content instance
    var instance = H5P.newRunnable(content, this.parent.contentId, H5P.jQuery(container), true, contentData);

    instance.on('navigated', function(e) {
      parent.trigger('navigated', e.data);
    });

    this.libraryInstances[id] = instance;

    // Bubble resize events
    this.bubbleUp(instance, 'resize', parent);

    // Remove any fullscreen buttons
    this.disableFullscreen(instance);
  };

  LibraryScreen.prototype.createNextLibraries = function (library) {
    this.nextLibraries = {};

    // If not a branching question, just load the next library
    if (library.content.library !== 'H5P.BranchingQuestion 1.0') {
      var nextLibrary = this.parent.getLibrary(library.nextContentId);
      if (nextLibrary == -1) {
        return; // Do nothing if the next screen is the end screen
      }
      // Do not preload branching questions
      if (nextLibrary.content.library !== 'H5P.BranchingQuestion 1.0') {
        this.nextLibraries[library.nextContentId] = this.createLibraryElement(nextLibrary, true);
        this.wrapper.append(this.nextLibraries[library.nextContentId]);
      }
    }

    // If it is a branching question, load all the possible libraries
    else {
      var ids = library.content.params.alternatives.map(alternative => alternative.nextContentId); // TODO: transpile
      ids.forEach(nextContentId => {
        var nextLibrary = this.parent.getLibrary(nextContentId);
        if (nextLibrary == -1) {
          return; // Do nothing if the next screen is the end screen
        }
        // Do not preload branching questions
        if (nextLibrary.content && nextLibrary.content.library !== 'H5P.BranchingQuestion 1.0') {
          this.nextLibraries[nextContentId] = this.createLibraryElement(nextLibrary, true);
          this.wrapper.append(this.nextLibraries[nextContentId]);
        }
      });
    }
  };

  /**
   * Remove custom fullscreen buttons from sub content.
   * (A bit of a hack, there should have been some sort of override…)
   *
   * @param {Object} instance
   */
  LibraryScreen.prototype.disableFullscreen = function (instance) {
    switch (instance.libraryInfo.machineName) {
      case 'H5P.CoursePresentation':
        if (instance.$fullScreenButton) {
          instance.$fullScreenButton.remove();
        }
        break;

      case 'H5P.InteractiveVideo':
        instance.on('controls', function () {
          if (instance.controls.$fullscreen) {
            instance.controls.$fullscreen.remove();
          }
        });
        break;
    }
  };

  LibraryScreen.prototype.bubbleUp = function(origin, eventName, target) {
    origin.on(eventName, function (event) {
      // Prevent target from sending event back down
      target.bubblingUpwards = true;
      target.trigger(eventName, event);

      // Reset
      target.bubblingUpwards = false;
    });
  };

  LibraryScreen.prototype.show = function () {
    var self = this;
    self.wrapper.classList.add('h5p-slide-in');

    // Style as the current screen
    self.wrapper.addEventListener('animationend', function() {
      self.wrapper.classList.remove('h5p-next-screen');
      self.wrapper.classList.remove('h5p-slide-in');
      self.wrapper.classList.add('h5p-current-screen');
    });
  };

  LibraryScreen.prototype.hide = function () {
    var self = this;
    self.wrapper.classList.add('h5p-slide-out');

    // Hide possible alternatives
    for (var i = 0; i < this.nextLibraries.length; i++) {
      this.nextLibraries[i].remove();
    }

    // Hide overlay and branching questions
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = undefined;
      this.branchingQuestions.forEach(bq => bq.remove());
    }

    self.wrapper.addEventListener('animationend', function() {
      self.wrapper.classList.remove('h5p-current-screen');
      self.wrapper.classList.add('h5p-next-screen');
      self.wrapper.classList.remove('h5p-slide-out');
    });
  };

  LibraryScreen.prototype.showNextLibrary = function (library) {
    this.nextLibraryId = library.nextContentId;

    // Show normal h5p library
    if (library.content.library !== 'H5P.BranchingQuestion 1.0') {
      // Update the title
      this.libraryTitle.innerHTML = library.contentTitle ? library.contentTitle : '';

      // Slide out the current library
      this.currentLibrary.classList.add('h5p-slide-out');
      this.currentLibrary.style.height = 0;

      // Remove the branching questions if they exist
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = undefined;
        this.branchingQuestions.forEach(bq => bq.remove());
      }

      // Remove preloaded libraries that were not selected
      for (var i = 0; i < this.nextLibraries.length; i++) {
        this.nextLibraries[i].remove();
      }

      // Slide in selected library
      var libraryWrapper = this.nextLibraries[library.contentId];
      libraryWrapper.classList.add('h5p-slide-in');

      this.currentLibraryInstance = this.libraryInstances[library.contentId];
      if (this.currentLibraryInstance.resize) {
        this.currentLibraryInstance.resize();
      }

      var self = this;
      this.currentLibrary.addEventListener('animationend', function() {
        self.currentLibrary.remove();
        self.currentLibrary = libraryWrapper;
        self.currentLibrary.classList.remove('h5p-next');
        self.currentLibrary.classList.remove('h5p-slide-in');
        self.currentLibraryElement = libraryWrapper.getElementsByClassName('h5p-branching-scenario-content')[0];
        self.createNextLibraries(library);
      });
      // TODO: Do not slide in the next slide if it is the same as the current one
    }

    else { // Show a branching question

      // Remove existing branching questions
      this.branchingQuestions.forEach(bq => bq.remove());

      // Add an overlay if it doesn't exist yet
      if (this.overlay === undefined) {
        this.overlay = document.createElement('div');
        this.overlay.className = 'h5p-branching-scenario-overlay';
        this.wrapper.append(this.overlay);
      }

      var branchingQuestion = document.createElement('div');
      branchingQuestion.className = 'h5p-branching-question-wrapper';

      this.appendRunnable(branchingQuestion, library.content);
      this.wrapper.append(branchingQuestion);
      this.branchingQuestions.push(branchingQuestion);

      var branchingQuestionActual = branchingQuestion.getElementsByClassName('h5p-branching-question')[0];
      branchingQuestionActual.classList.add('h5p-start-outside');
      branchingQuestionActual.classList.add('h5p-fly-in');

      this.currentLibrary.style.zIndex = 0;
      this.createNextLibraries(library);
    }
  };

  LibraryScreen.prototype.getElement = function () {
    return this.wrapper;
  };

  LibraryScreen.prototype.remove = function () {
    this.wrapper.remove();
  };

  LibraryScreen.prototype.resize = function (event) {
    this.currentLibraryInstance.trigger('resize', event);
  };

  return LibraryScreen;
})();