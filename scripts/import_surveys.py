# Import script for loading parcel and survey data
# Install dependencies: pip install pandas openpyxl psycopg2

import pandas as pd
import psycopg2
import os
from datetime import datetime

# Database connection
DB_CONFIG = {
    'dbname': 'geoportail',
    'user': 'postgres',
    'password': 'Sensei00',
    'host': 'localhost',
    'port': '5432'
}

def clean_value(value):
    """Convert NaN/None to None for SQL"""
    if pd.isna(value):
        return None
    return value

def import_individual_surveys(filepath):
    """Import individual survey data from XLSX"""
    print(f"\n📋 Reading individual surveys from: {filepath}")
    
    try:
        df = pd.read_excel(filepath)
        print(f"   Found {len(df)} individual survey records")
        
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        imported = 0
        skipped = 0
        
        for idx, row in df.iterrows():
            try:
                num_parcel = clean_value(row.get('Num_parcel'))
                
                if not num_parcel:
                    skipped += 1
                    continue
                
                # Insert individual survey
                cur.execute("""
                    INSERT INTO individual_surveys (
                        num_parcel, start_time, today, prenom, nom, sexe, date_naiss, lieu_naiss,
                        telephone, email, nat, autres_nat, type_piece, num_piece, date_deliv,
                        photo_rec, photo_rec_url, photo_ver, photo_ver_url, num_tel, vocation,
                        occup_nord, occup_sud, occup_est, occup_ouest, type_usag, syst_cultu,
                        type_cult_001, source_ali, irrigation, sup_declar, sup_exploi, sup_reelle,
                        sup_affect, coord_x, coord_y, centro_de_latitude, centro_de_longitude,
                        centro_de_altitude, centro_de_precision, mode_acces, type_doc, deliv_recu,
                        num_decise, date_decise, conflit_f, cause_conf, comnt_conf, date_conf,
                        prota_conf, resol_conf
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (num_parcel) DO UPDATE SET
                        prenom = EXCLUDED.prenom,
                        nom = EXCLUDED.nom,
                        telephone = EXCLUDED.telephone,
                        sexe = EXCLUDED.sexe,
                        vocation = EXCLUDED.vocation,
                        sup_declar = EXCLUDED.sup_declar,
                        sup_reelle = EXCLUDED.sup_reelle,
                        photo_rec_url = EXCLUDED.photo_rec_url,
                        photo_ver_url = EXCLUDED.photo_ver_url,
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    num_parcel,
                    clean_value(row.get('start')),
                    clean_value(row.get('today')),
                    clean_value(row.get('Prenom')),
                    clean_value(row.get('Nom')),
                    clean_value(row.get('Sexe')),
                    clean_value(row.get('Date_naiss')),
                    clean_value(row.get('Lieu_naiss')),
                    clean_value(row.get('Telephone')),
                    clean_value(row.get('Email')),
                    clean_value(row.get('Nat')),
                    clean_value(row.get('Autres_nat')),
                    clean_value(row.get('Type_piece')),
                    clean_value(row.get('Num_piece')),
                    clean_value(row.get('Date_deliv')),
                    clean_value(row.get('Photo_rec')),
                    clean_value(row.get('Photo_rec_URL')),
                    clean_value(row.get('Photo_ver')),
                    clean_value(row.get('Photo_ver_URL')),
                    clean_value(row.get('Num_Tel')),
                    clean_value(row.get('Vocation')),
                    clean_value(row.get('Occup_nord')),
                    clean_value(row.get('Occup_sud')),
                    clean_value(row.get('Occup_est')),
                    clean_value(row.get('Occup_ouest')),
                    clean_value(row.get('type_usag')),
                    clean_value(row.get('Syst_cultu')),
                    clean_value(row.get('Type_cult_001')),
                    clean_value(row.get('Source_ali')),
                    clean_value(row.get('Irrigation')),
                    clean_value(row.get('Sup_declar')),
                    clean_value(row.get('Sup_exploi')),
                    clean_value(row.get('Sup_reelle')),
                    clean_value(row.get('Sup_affect')),
                    clean_value(row.get('Coord_X')),
                    clean_value(row.get('Coord_Y')),
                    clean_value(row.get('_Centro_de_latitude')),
                    clean_value(row.get('_Centro_de_longitude')),
                    clean_value(row.get('_Centro_de_altitude')),
                    clean_value(row.get('_Centro_de_precision')),
                    clean_value(row.get('Mode_acces')),
                    clean_value(row.get('Type_doc')),
                    clean_value(row.get('Deliv_recu')),
                    clean_value(row.get('Num_decise')),
                    clean_value(row.get('Date_decise')),
                    clean_value(row.get('Conflit_f')),
                    clean_value(row.get('Cause_conf')),
                    clean_value(row.get('Comnt_Conf')),
                    clean_value(row.get('Date_conf')),
                    clean_value(row.get('Prota_conf')),
                    clean_value(row.get('Resol_conf'))
                ))
                
                imported += 1
                
            except Exception as e:
                print(f"   ⚠️  Error on row {idx}: {e}")
                skipped += 1
                continue
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"   ✅ Imported {imported} individual surveys, skipped {skipped}")
        return imported
        
    except Exception as e:
        print(f"   ❌ Error importing individual surveys: {e}")
        return 0

def import_collective_surveys(filepath):
    """Import collective survey data from XLSX"""
    print(f"\n📋 Reading collective surveys from: {filepath}")
    
    try:
        df = pd.read_excel(filepath)
        print(f"   Found {len(df)} collective survey records")
        
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        imported = 0
        skipped = 0
        
        for idx, row in df.iterrows():
            try:
                num_parcel = clean_value(row.get('Num_parcel'))
                
                if not num_parcel:
                    skipped += 1
                    continue
                
                # Insert collective survey
                cur.execute("""
                    INSERT INTO collective_surveys (
                        num_parcel, start_time, today, cas_de_personne_001, nombre_affectata,
                        vocation, occup_nord, occup_sud, occup_est, occup_ouest, type_usag,
                        syst_cultu, type_cult_001, source_ali, irrigation, sup_declar, sup_exploi,
                        sup_reelle, sup_affect, coord_x, coord_y, centro_de_latitude,
                        centro_de_longitude, centro_de_altitude, centro_de_precision, mode_acces,
                        type_doc, deliv_recu, num_decise, date_decise, conflit_f, cause_conf,
                        comnt_conf, date_conf, prota_conf, resol_conf
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (num_parcel) DO UPDATE SET
                        nombre_affectata = EXCLUDED.nombre_affectata,
                        vocation = EXCLUDED.vocation,
                        sup_declar = EXCLUDED.sup_declar,
                        sup_reelle = EXCLUDED.sup_reelle,
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    num_parcel,
                    clean_value(row.get('start')),
                    clean_value(row.get('today')),
                    clean_value(row.get('Cas_de_Personne_001')),
                    clean_value(row.get('Quel_est_le_nombre_d_affectata')),
                    clean_value(row.get('Vocation')),
                    clean_value(row.get('Occup_nord')),
                    clean_value(row.get('Occup_sud')),
                    clean_value(row.get('Occup_est')),
                    clean_value(row.get('Occup_ouest')),
                    clean_value(row.get('type_usag')),
                    clean_value(row.get('Syst_cultu')),
                    clean_value(row.get('Type_cult_001')),
                    clean_value(row.get('Source_ali')),
                    clean_value(row.get('Irrigation')),
                    clean_value(row.get('Sup_declar')),
                    clean_value(row.get('Sup_exploi')),
                    clean_value(row.get('Sup_reelle')),
                    clean_value(row.get('Sup_affect')),
                    clean_value(row.get('Coord_X')),
                    clean_value(row.get('Coord_Y')),
                    clean_value(row.get('_Centro_de_latitude')),
                    clean_value(row.get('_Centro_de_longitude')),
                    clean_value(row.get('_Centro_de_altitude')),
                    clean_value(row.get('_Centro_de_precision')),
                    clean_value(row.get('Mode_acces')),
                    clean_value(row.get('Type_doc')),
                    clean_value(row.get('Deliv_recu')),
                    clean_value(row.get('Num_decise')),
                    clean_value(row.get('Date_decise')),
                    clean_value(row.get('Conflit_f')),
                    clean_value(row.get('Cause_conf')),
                    clean_value(row.get('Comnt_Conf')),
                    clean_value(row.get('Date_conf')),
                    clean_value(row.get('Prota_conf')),
                    clean_value(row.get('Resol_conf'))
                ))
                
                # Import beneficiaries (up to 27)
                collective_survey_id = cur.lastrowid if cur.lastrowid else None
                
                for i in range(1, 28):
                    prenom_col = f'Prenom_{i:03d}'
                    nom_col = f'Nom_{i:03d}'
                    
                    if prenom_col in row and not pd.isna(row[prenom_col]):
                        cur.execute("""
                            INSERT INTO beneficiaries (
                                num_parcel, beneficiary_number, prenom, nom, sexe, date_naiss
                            ) VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            num_parcel,
                            i,
                            clean_value(row.get(prenom_col)),
                            clean_value(row.get(nom_col)),
                            clean_value(row.get(f'Sexe_{i:03d}')),
                            clean_value(row.get(f'Date_naiss_{i:03d}'))
                        ))
                
                imported += 1
                
            except Exception as e:
                print(f"   ⚠️  Error on row {idx}: {e}")
                skipped += 1
                continue
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"   ✅ Imported {imported} collective surveys, skipped {skipped}")
        return imported
        
    except Exception as e:
        print(f"   ❌ Error importing collective surveys: {e}")
        return 0

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Starting Survey Data Import")
    print("=" * 60)
    
    individual_file = r"C:\Users\USER\Documents\Boundou_Geoportail\data\Survey\Enquete_Foncière-Parcelles_Individuelles_17112025.xlsx"
    collective_file = r"C:\Users\USER\Documents\Boundou_Geoportail\data\Survey\Enquete_Foncière-Parcelles_Collectives_17112025.xlsx"
    
    total = 0
    
    if os.path.exists(individual_file):
        total += import_individual_surveys(individual_file)
    else:
        print(f"❌ File not found: {individual_file}")
    
    if os.path.exists(collective_file):
        total += import_collective_surveys(collective_file)
    else:
        print(f"❌ File not found: {collective_file}")
    
    print("\n" + "=" * 60)
    print(f"✅ Import completed! Total records: {total}")
    print("=" * 60)
