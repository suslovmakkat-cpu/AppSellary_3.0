import json

def check_backup():
    try:
        # Пробуем разные кодировки
        encodings = ['utf-8', 'utf-8-sig', 'cp1251', 'windows-1251']
        
        for encoding in encodings:
            try:
                with open('salary_backup.json', 'r', encoding=encoding) as f:
                    data = json.load(f)
                print(f"✅ Успешно прочитано с кодировкой: {encoding}")
                break
            except UnicodeDecodeError:
                print(f"❌ Не удалось прочитать с кодировкой: {encoding}")
                continue
        else:
            print("❌ Не удалось прочитать файл ни с одной кодировкой")
            return
        
        print(f"\\n📊 Содержимое backup:")
        print(f"Операторов: {len(data.get('operators', []))}")
        print(f"Расчетов: {len(data.get('manualCalculations', []))}")
        print(f"Выплат: {len(data.get('payments', []))}")
        
        print("\\n👥 Операторы:")
        for op in data.get('operators', []):
            print(f"  ID: {op.get('id')}, Имя: {op.get('name')}, Тип: {op.get('motivation_type')}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")

check_backup()
