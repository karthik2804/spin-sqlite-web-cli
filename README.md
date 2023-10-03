## Spin Sqlite Web CLI

This is a simple spin component to create a web CLI to interact with the sqlite database.

### Installing and using the template

```bash
spin templates install --upgrade --git https://github.com/karthik2804/spin-sqlite-web-cli/
```

To create a new component
```bash
spin add sqlite-cli
```
Running the component locally requires two environment variables to be set

```
export SPIN_CONFIG_SQLITE_USERNAME="<username>"
export SPIN_CONFIG_SQLITE_PASSWORD="<password>"
```

### Limitations

It currently only access the defaut Sqlite database.