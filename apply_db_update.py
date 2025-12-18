from schema_manager import ensure_schema


def main():
    ensure_schema()
    print("DB update applied successfully")


if __name__ == "__main__":
    main()
