# TrelloMetrics
Track cycle time and defect rate for a trello board

##Assumptions
 * Cycle time can be calculated by looking at time spent in one list on one board
 * Cards do not move in and out of the list multiple times
 * An action is defined as a card changing lists. No more than 1,000 actions will occur on the board in one day.

## Setup
Function config settings
```bash
firebase functions:config:set \
  trello.list=<<list id>> \
  trello.board=<<board id>> \
  trello.access_key= \
  trello.api_key=
```
The `list` and `board` will be the board and list cycle time is calculated from.

You can get your `api_key` from [https://trello.com/app-key](https://trello.com/app-key) and your `access_key` from [https://trello.com/1/token/approve](https://trello.com/1/token/approve)

