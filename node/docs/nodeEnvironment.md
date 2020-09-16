# Node Handler Versioning

As of agent version 2.175.0, Azure Pipelines supports running tasks in a Node 14 environment in addition to the previously supported Node 6 and Node 10 environment.

To leverage this capability, simply add `Node14` as an execution target:

```
"execution": {
        "Node14": {
            "target": "path/to/entry"
        }
    },
```

Existing `Node` and `Node10` execution targets will still resolve to a Node 6 and Node 10 environment respectively for now to maintain back-compat.

### Testing your task

If you use the task-lib for testing, it will automatically use the appropriate version of Node to test your tasks, downloading it if necessary.
