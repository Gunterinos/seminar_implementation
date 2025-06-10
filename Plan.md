# Setup

1. Make dimBridge work.
2. Make a new observable notebook that uses simplified dimBridge.
3. Create a new directory for the implementation.

# Implementation

1. Investigate what is needed from the dimBridge for implementation.
   - predicate implementations -> smooth-bump-predicate.ipynb
   - we can extract the logic from there and create a new notebook that spits out what we need
   - first only compute_predicate then compute_predicate_sequence
   - so whenever we call the predicate regression I want to spit out the intermediary steps
2. Investigate how we could visualize the predicates (point color or lines).
   - the first step would be to visualize how the predicate looks at the start, that would be useful
   - I think we should resort to colours
3. See if we could do it directly in the observable notebook.
   - we can't do it directly in the observable notebook
4. If not, create new code in the project here.

- additional things to do:
- create new notebook in observable
- actually everything is in app.py in compute_predicate_sequence
- I guess compute_predicate_sequence can take only one region
- investigate if I need to add back compute_predicate or not, this might be why it sucks for single selection
- so plan would be the following
  - Ask about how to keep code at seminar, can I just remake the app.py but label the old code and the new code?
  - remake app.py first for single region
  - show the initial predicate
  - make it so we can show step by step 
  - make it so we can select a feature we want
  - make it so we can select a combination of features we want
  - maybe color them differently or something like that
  - now make it so it works for a sequence of regions
  - make it so we can select which regions we want

# What we want to achieve

1. You can clearly select predicates and see their boundaries in the projection view.
2. You can go step by step through the gradient descent and see how the predicates change.
3. You can select a multiple predicates and see how they interact with each other.


- ~~show the initial predicate~~
- ~~make it so we can show step by step~~
- ~~currently the dimensions that have a too large range are not shown in the projection view~~
- ~~add the confusion matrix~~
- ~~make it possible to select different datasets~~
- ~~make it so we can select a feature we want~~
- ~~make it so we can select a combination of features we want~~
- ~~add distribution plots on the predicate barplot, to see what data we select~~
- ~~fix predicate clauses to have a scroll bar if they don't fit~~
- ~~fix so text wraps for predicate clauses, when the title doesn't fit~~
- ~~sliders for the predicates (don't know where )~~
- fix so we can have train step between 1 and 1000 instead of 0 to 999
- comparison with other regions
- now make it so it works for a sequence of regions
- make it so we can select which regions we want