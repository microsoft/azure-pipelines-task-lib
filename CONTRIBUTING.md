# How to contribute

One of the best ways to contribute is to participate in discussions and request features you need. You can also contribute by submitting pull requests with code changes.

## General feedback and discussion

Start or join into a discussion on the [issue tracker](https://github.com/Microsoft/vsts-task-lib/issues).

## Bugs feature requests

Create a [new issue](https://github.com/Microsoft/vsts-task-lib/issues/new).

## General contribution guide

> Keep in mind: most of the code in this repository is auto-generated, but you can contribute to the non-generated aspects of the library. 

1. Unless it is a trivial change, make sure that there is a corresponding issue for your change first. If there is none, create one.
2. Create a fork in GitHub
3. Create a branch off the `master` branch. Name it something that makes sense, such as `issue-123` or `githubhandle-issue`. This makes it easy for everyone to figure out what the branch is used for. It also makes it easier to isolate your change from incoming changes from the origin.
4. Commit your changes and push your changes to GitHub
5. Create a pull request against the origin's `master` branch. [Learn more about pull requests](https://help.github.com/articles/using-pull-requests) 

Before submitting a feature or substantial code contribution, please discuss it with the team and ensure it follows the product roadmap. 

You might also read these two blogs posts on contributing code: [Open Source Contribution Etiquette](http://tirania.org/blog/archive/2010/Dec-31.html) by Miguel de Icaza and [Don't "Push" Your Pull Requests](http://www.igvita.com/2011/12/19/dont-push-your-pull-requests/) by Ilya Grigorik.

### Commits

Please format commit messages as follows (based on this [excellent post](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)):

```
Summarize change in 50 characters or less

Provide more detail after the first line. Leave one blank line below the
summary and wrap all lines at 72 characters or less.

If the change fixes an issue, leave another blank line after the final
paragraph and indicate which issue is fixed in the specific format
below.

Fix #42
```

Also do your best to factor commits appropriately, i.e not too large with unrelated
things in the same commit, and not too small with the same small change applied N
times in N different commits. If there was some accidental reformatting or whitespace
changes during the course of your commits, please rebase them away before submitting
the PR.

# Instructions for Logging Issues

## 1. Search for Duplicates

[Search the existing issues](https://github.com/Microsoft/vsts-task-lib/issues) before logging a new one.

## 2. Did you find a bug?

When logging a bug, please be sure to include the following:
 * What version are you using?
 * If at all possible, an *isolated* way to reproduce the behavior
 * The behavior you expect to see, and the actual behavior
 * Ensure it doesn't reproduce on the latest version or master
 * An http trace from fiddler or charles if possible (the relevant parts)

## 5. Do you have a suggestion?

We also accept suggestions in the issue tracker.

In general, things we find useful when reviewing suggestions are:
* A description of the problem you're trying to solve
* An overview of the suggested solution
* Examples of how the suggestion would work in various places
  * Code examples showing e.g. "this would be an error, this wouldn't"
  * Code examples showing the generated JavaScript (if applicable)
* If relevant, precedent in other languages can be useful for establishing context and expected behavior

# Instructions for Contributing Code

## Contributing bug fixes

We are currently accepting contributions in the form of bug fixes. A bug must have an issue tracking it in the issue tracker. Your pull request should include a link to the bug that you are fixing. If you've submitted a PR for a bug, please post a comment in the bug to avoid duplication of effort.

## Contributing features

Features (things that add new or improved functionality) may be accepted, but will need to first be approved in the form of a suggestion issue.

Design changes will not be accepted at this time. If you have a design change proposal, please log a suggestion issue.

## Legal

You will need to complete a Contributor License Agreement (CLA). Briefly, this agreement testifies that you are granting us permission to use the submitted change according to the terms of the project's license, and that the work being submitted is under appropriate copyright.

Please submit a Contributor License Agreement (CLA) before submitting a pull request. You may visit https://cla.microsoft.com to sign digitally. 

## Housekeeping

Your pull request should: 

* Include a description of what your change intends to do
* Be a child commit of a reasonably recent commit in the **master** branch 
    * Requests need not be a single commit, but should be a linear sequence of commits (i.e. no merge commits in your PR)
* It is desirable, but not necessary, for the tests to pass at each commit
* Have clear commit messages 
    * e.g. "Refactor feature", "Fix issue", "Add tests for issue"
* Include samples if appropriate
* Include adequate tests 
    * At least one test should fail in the absence of your non-test code changes. If your PR does not match this criteria, please specify why
    * Tests should include reasonable permutations of the target fix/change
    * Include baseline changes with your change
    * All changed code must have 100% code coverage

## Contributor license agreement

You must sign a [Contributor License Agreement](https://cla.microsoft.com/) before submitting your pull request. To complete the Contributor License Agreement (CLA), you will need to submit a request via the [form](https://cla.microsoft.com/) and then electronically sign the CLA when you receive the email containing the link to the document. You need to sign the CLA only once to cover submission to any Microsoft OSS project. 
