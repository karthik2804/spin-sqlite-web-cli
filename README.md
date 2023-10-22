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
**note**: When running the spin add, the component will try add its config variables to the `spin.toml`, if you already have a `[variables]` section, consolidate the values. 

Running the component locally requires two environment variables to be set


```
export SPIN_CONFIG_SQLITE_USERNAME="<username>"
export SPIN_CONFIG_SQLITE_PASSWORD="<password>"
```

### Features

- Basic support for dot commands like `.tables`, `.schema`, `.dump`, `.database` and `.format`
    - The `.dump` command is highly experimental
- Output in the form of JSON or a table

### Limitations

- It is a work in progress, so there definitely might be bugs. If you find one please open an [issue](https://github.com/karthik2804/spin-sqlite-web-cli)