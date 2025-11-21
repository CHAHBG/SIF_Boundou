/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./*.{html,js}"],
    theme: {
        extend: {
            colors: {
                navy: {
                    DEFAULT: '#1e3a5f', // En-têtes et navigation
                },
                blue: {
                    medium: '#2563a8', // Boutons et liens
                    light: '#4a90d9',  // Accents et survols
                },
                gold: {
                    DEFAULT: '#f4c430', // Éléments importants, badges
                },
                brown: {
                    DEFAULT: '#8b4513', // Complémentaire PROCASEF
                },
                green: {
                    marker: '#7cb342', // Marqueurs de localisation
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
