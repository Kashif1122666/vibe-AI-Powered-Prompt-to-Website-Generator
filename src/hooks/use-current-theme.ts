import  {useTheme} from "next-themes"


export  const userCurrentTheme = ()=>{
    const  {theme, systemTheme}  = useTheme();

    if(theme === "dark" ||  theme === "light"){
        return theme;
    }

    return systemTheme;
};