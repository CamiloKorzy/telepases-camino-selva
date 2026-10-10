import os
from PIL import Image, ImageDraw

def create_square_icon(symbol_img, size, bg_color='#0F291E', rounded=False, padding_percent=0.2):
    # Create base canvas
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    
    if bg_color:
        if rounded:
            radius = int(size * 0.22)
            draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=bg_color)
        else:
            draw.rectangle([0, 0, size, size], fill=bg_color)
            
    # Calculate target symbol size with padding
    target_max = int(size * (1.0 - padding_percent * 2))
    
    # Scale symbol preserving aspect ratio
    sym_w, sym_h = symbol_img.size
    ratio = min(target_max / sym_w, target_max / sym_h)
    new_w = max(1, int(sym_w * ratio))
    new_h = max(1, int(sym_h * ratio))
    
    resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
    sym_resized = symbol_img.resize((new_w, new_h), resample_filter)
    
    # Position centered
    pos_x = (size - new_w) // 2
    pos_y = (size - new_h) // 2
    
    icon.paste(sym_resized, (pos_x, pos_y), sym_resized)
    return icon

def create_round_icon(symbol_img, size, bg_color='#0F291E', padding_percent=0.2):
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    draw.ellipse([0, 0, size, size], fill=bg_color)
    
    target_max = int(size * (1.0 - padding_percent * 2))
    sym_w, sym_h = symbol_img.size
    ratio = min(target_max / sym_w, target_max / sym_h)
    new_w = max(1, int(sym_w * ratio))
    new_h = max(1, int(sym_h * ratio))
    
    resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
    sym_resized = symbol_img.resize((new_w, new_h), resample_filter)
    
    pos_x = (size - new_w) // 2
    pos_y = (size - new_h) // 2
    
    icon.paste(sym_resized, (pos_x, pos_y), sym_resized)
    return icon

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    iso_path = os.path.join(root_dir, 'Documentos', 'Logo', 'Isotipo - Color principal.png')
    
    if not os.path.exists(iso_path):
        print(f"Error: {iso_path} not found.")
        return

    full_iso = Image.open(iso_path).convert('RGBA')
    bbox = full_iso.getbbox()
    symbol = full_iso.crop(bbox) if bbox else full_iso
    
    print("Source isotipo size:", full_iso.size, "Cropped symbol size:", symbol.size)
    
    # 1. Generate Favicons for Web
    public_dir = os.path.join(root_dir, 'public')
    app_dir = os.path.join(root_dir, 'app')
    bg_color = '#FFFFFF'
    
    # Create 512x512 master icon
    master_512 = create_square_icon(symbol, 512, bg_color=bg_color, rounded=True, padding_percent=0.18)
    master_512.save(os.path.join(public_dir, 'icon-512.png'))
    master_512.save(os.path.join(public_dir, 'android-chrome-512x512.png'))
    
    # Create 192x192
    master_192 = create_square_icon(symbol, 192, bg_color=bg_color, rounded=True, padding_percent=0.18)
    master_192.save(os.path.join(public_dir, 'icon-192.png'))
    master_192.save(os.path.join(public_dir, 'android-chrome-192x192.png'))
    
    # Create Apple Touch Icon (180x180)
    apple_180 = create_square_icon(symbol, 180, bg_color=bg_color, rounded=False, padding_percent=0.18)
    apple_180.save(os.path.join(public_dir, 'apple-touch-icon.png'))
    apple_180.save(os.path.join(app_dir, 'apple-icon.png'))
    
    # Create 32x32 Favicon PNG
    fav_32 = create_square_icon(symbol, 32, bg_color=bg_color, rounded=True, padding_percent=0.12)
    fav_32.save(os.path.join(public_dir, 'favicon-32x32.png'))
    fav_32.save(os.path.join(public_dir, 'favicon.png'))
    fav_32.save(os.path.join(app_dir, 'icon.png'))
    
    # Create 16x16 Favicon PNG
    fav_16 = create_square_icon(symbol, 16, bg_color=bg_color, rounded=True, padding_percent=0.10)
    fav_16.save(os.path.join(public_dir, 'favicon-16x16.png'))
    
    # Save ICO
    fav_32.save(os.path.join(public_dir, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    fav_32.save(os.path.join(app_dir, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    
    print("Generated Web Favicons successfully.")
    
    # 2. Generate Android Launcher Icons
    android_res = os.path.join(root_dir, 'android', 'app', 'src', 'main', 'res')
    
    density_sizes = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }
    
    for folder, (ic_size, fg_size) in density_sizes.items():
        folder_path = os.path.join(android_res, folder)
        if not os.path.exists(folder_path):
            os.makedirs(folder_path, exist_ok=True)
            
        # Standard launcher (rounded square)
        sq_icon = create_square_icon(symbol, ic_size, bg_color=bg_color, rounded=True, padding_percent=0.18)
        sq_icon.save(os.path.join(folder_path, 'ic_launcher.png'))
        
        # Round launcher (circular)
        rd_icon = create_round_icon(symbol, ic_size, bg_color=bg_color, padding_percent=0.18)
        rd_icon.save(os.path.join(folder_path, 'ic_launcher_round.png'))
        
        # Foreground launcher (transparent background)
        fg_icon = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        target_max = int(fg_size * 0.55)
        sym_w, sym_h = symbol.size
        ratio = min(target_max / sym_w, target_max / sym_h)
        new_w = max(1, int(sym_w * ratio))
        new_h = max(1, int(sym_h * ratio))
        resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
        sym_res = symbol.resize((new_w, new_h), resample_filter)
        fg_icon.paste(sym_res, ((fg_size - new_w) // 2, (fg_size - new_h) // 2), sym_res)
        fg_icon.save(os.path.join(folder_path, 'ic_launcher_foreground.png'))
        
        print(f"Generated Android icons for {folder}")

if __name__ == '__main__':
    main()
