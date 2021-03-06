H5P.BranchingScenario.Scoring = (function () {

  const SCORE_TYPES = {
    STATIC_SCORE: 'static-end-score',
    DYNAMIC_SCORE: 'dynamic-score',
    NO_SCORE: 'no-score',
  };

  /**
   * Handles scoring
   *
   * @param params
   * @constructor
   */
  function Scoring(params) {
    const self = this;
    let scores = [];
    let visitedIndex = 0;
    let maxScore = null;

    /**
     * Check if library has end score
     *
     * @param {object} library
     * @returns {boolean} True if library has end score
     */
    const hasEndScreenScore = function (library) {
      return library
        && library.feedback
        && library.feedback.endScreenScore !== undefined;
    };

    /**
     * Find all branching paths with an ending from the given content
     *
     * @param content Content to find branching paths from
     * @param visitedNodes Currently visited nodes, loops are ignored
     * @returns {Array} List of possible paths leading to an ending
     */
    const findBranchingPaths = function (content, visitedNodes) {
      if (!self.isBranchingQuestion(content)) {
        return findBranchingEndings(content, visitedNodes);
      }

      // Check all alternatives for branching question
      let foundPaths = [];
      const alternatives = content.type.params.branchingQuestion.alternatives;
      alternatives.forEach(function (alt, index) {
        const accumulatedNodes = visitedNodes.concat({
          type: 'alternative',
          index: index,
          alternativeParent: visitedNodes[visitedNodes.length - 1].index,
        });

        const paths = findBranchingEndings(alt, accumulatedNodes);
        foundPaths = foundPaths.concat(paths);
      });
      return foundPaths;
    };

    /**
     * Find paths with endings from a content or alternative
     *
     * @param {object} content Content or alternative
     * @param {Array} visitedNodes List of visited nodes
     * @returns {Array} List of found paths with an end from the given content
     */
    const findBranchingEndings = function (content, visitedNodes) {
      // Ending screen
      if (content.nextContentId === -1) {
        return [visitedNodes];
      }

      const isLoop = visitedNodes.some(function (node) {
        return node.index === content.nextContentId;
      });

      // Skip loops as they are already explored
      if (!isLoop) {
        const nextContent = params.content[content.nextContentId];
        const accumulatedNodes = visitedNodes.concat({
          type: 'content',
          index: content.nextContentId,
          alternativeParent: null,
        });
        return findBranchingPaths(nextContent, accumulatedNodes);
      }

      return [];
    };

    /**
     * Calculates max score
     *
     * @returns {number} Max score
     */
    const calculateMaxScore = function () {
      if (params.scoringOption === SCORE_TYPES.STATIC_SCORE) {
        return calculateStaticMaxScore();
      }
      else if (params.scoringOption === SCORE_TYPES.DYNAMIC_SCORE) {
        return calculateDynamicMaxScore();
      }
      // No scoring
      return 0;
    };

    /**
     * Calculates static max score
     *
     * @returns {number}
     */
    const calculateStaticMaxScore = function () {
      const defaultEndScore = params.endScreens[0].endScreenScore;
      const defaultMaxScore = defaultEndScore !== undefined
        ? defaultEndScore : 0;

      // Find max score by checking which ending scenario has the highest score
      return params.content.reduce(function (acc, content) {
        // Flatten alternatives
        let choices = [content];
        if (self.isBranchingQuestion(content)) {
          choices = content.type.params.branchingQuestion.alternatives;
        }
        return acc.concat(choices);
      }, []).filter(function (content) {
        return content.nextContentId === -1;
      }).reduce(function (prev, content) {
        let score = hasEndScreenScore(content)
          ? content.feedback.endScreenScore
          : defaultMaxScore;

        return prev >= score ? prev : score;
      }, 0);
    };

    /**
     * Calculates dynamic max score
     *
     * @returns {number}
     */
    const calculateDynamicMaxScore = function () {
      const startNode = params.content[0];
      const visitedNodes = [{
        type: 'content',
        index: 0,
        alternativeParent: null,
      }];

      // DFS from start node to find all possible paths
      const foundPaths = findBranchingPaths(startNode, visitedNodes);

      // Find summarized score for all paths and grab max
      return foundPaths.map(function (path) {
        return path.map(function (p) {
          // Grab score for each path list
          let content = null;
          if (p.type === 'alternative') {
            const branchingQuestion = params.content[p.alternativeParent];
            const alternatives = branchingQuestion.type.params
              .branchingQuestion.alternatives;

            content = alternatives[p.index];
          }
          else {
            content = params.content[p.index];
          }

          if (hasEndScreenScore(content)) {
            return content.feedback.endScreenScore;
          }

          // No score found
          return 0;
        }).reduce(function (sum, score) {
          return sum + score;
        }, 0);
      }).reduce(function (prev, score) {
        return prev >= score ? prev : score;
      }, 0);
    };

    /**
     * Get score for a Branching Question alternative
     *
     * @param libraryParams
     * @param chosenAlternative
     * @returns {*}
     */
    const getAlternativeScore = function (libraryParams, chosenAlternative) {
      if (!(chosenAlternative >= 0)) {
        return 0;
      }

      const hasAlternative = libraryParams
        && libraryParams.type
        && libraryParams.type.params
        && libraryParams.type.params.branchingQuestion
        && libraryParams.type.params.branchingQuestion.alternatives
        && libraryParams.type.params.branchingQuestion.alternatives[chosenAlternative];

      if (!hasAlternative) {
        return 0;
      }
      const alt = libraryParams.type.params.branchingQuestion.alternatives[chosenAlternative];

      if (!hasEndScreenScore(alt)) {
        return 0;
      }

      return alt.feedback.endScreenScore;
    };

    /**
     * Get current score. Uses screen score if configured to use static score.
     *
     * @param {number} screenScore Used when static score is configured
     * @returns {number} Current score
     */
    this.getScore = function (screenScore) {
      if (params.scoringOption === SCORE_TYPES.DYNAMIC_SCORE) {
        return scores.reduce(function (previousValue, score) {
          return previousValue + score.score;
        }, 0);
      }
      else if (params.scoringOption === SCORE_TYPES.STATIC_SCORE) {
        return screenScore;
      }
      else {
        return 0;
      }
    };

    /**
     * Get max score for the whole branching scenario depending on scoring options
     *
     * @returns {number} Max score for branching scenario
     */
    this.getMaxScore = function () {
      if (!maxScore) {
        maxScore = calculateMaxScore();
      }

      return maxScore;
    };

    /**
     * Restart scoring
     */
    this.restart = function () {
      scores = [];
      visitedIndex = 0;
    };

    /**
     * Retrieve current library's score
     *
     * @param {number} currentId Id of current question
     * @param {number} libraryId Id of current library
     * @param {number} [chosenAlternative] Chosen alternative for branching
     *  questions
     */
    this.addLibraryScore = function (currentId, libraryId, chosenAlternative) {
      visitedIndex = visitedIndex + 1;
      const libraryParams = params.content[currentId];
      let currentLibraryScore = 0;

      // For Branching Questions find score for chosen alternative
      if (currentId !== libraryId) {
        currentLibraryScore =
          getAlternativeScore(libraryParams, chosenAlternative);
      }
      else {
        if (hasEndScreenScore(libraryParams)) {
          currentLibraryScore = libraryParams.feedback.endScreenScore;
        }
      }

      // Update existing score and detect loops
      let isLoop = false;
      let loopBackIndex = -1;
      scores.forEach(function (score) {
        if (score.id === currentId) {
          score.score = currentLibraryScore;
          loopBackIndex = score.visitedIndex;
          isLoop = true;
        }
      });

      if (isLoop) {
        // Remove all scores visited after loop
        scores = scores.filter(function (score) {
          return score.visitedIndex <= loopBackIndex;
        });
        visitedIndex = loopBackIndex;
      }
      else {
        scores.push({
          visitedIndex: visitedIndex,
          id: currentId,
          score: currentLibraryScore,
        });
      }
    };

    /**
     * Check if library is a Branching Question
     *
     * @param {object|string} library
     * @returns {boolean} True if library is a Branching Question
     */
    this.isBranchingQuestion = function (library) {
      let libraryString = library;
      if (library && library.type && library.type.library) {
        libraryString = library.type.library;
      }

      return libraryString.split(' ')[0] === 'H5P.BranchingQuestion';
    };

    /**
     * Check if scoring is dynamic
     *
     * @returns {boolean} True if dynamic scoring
     */
    this.isDynamicScoring = function () {
      return params.scoringOption === SCORE_TYPES.DYNAMIC_SCORE;
    };

    /**
     * Determines if score types are configured to show scores
     *
     * @returns {boolean} True if score should show
     */
    this.shouldShowScore = function () {
      return params.scoringOption === SCORE_TYPES.STATIC_SCORE
        || this.isDynamicScoring();
    };
  }

  return Scoring;
})();