import React from "react";

import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import ProgressBar from "./ProgressBar";

export default function RankingCard({

  evolution = {},

}) {

  const cityRanking =
    evolution?.cityRanking || {};

  const professionRanking =
    evolution?.professionRanking || {};

  const reward =
    evolution?.reward || {};

  const season =
    evolution?.season || {};

  const score =
    evolution?.score || 0;

  const distance =
    evolution?.distanceLeader || 0;

  function getMedal(position){

    switch(position){

      case 1:
        return "🥇";

      case 2:
        return "🥈";

      case 3:
        return "🥉";

      default:
        return "🏅";

    }

  }

  function getMessage(){

    if(cityRanking?.position===1){

      return "Você lidera o ranking da sua cidade. Continue ativo para manter sua posição.";

    }

    if(distance<=3){

      return `Você está a apenas ${distance} pontos da liderança.`;

    }

    if(cityRanking?.position<=10){

      return "Você já faz parte dos profissionais em destaque da cidade.";

    }

    return "Continue evoluindo para subir rapidamente no ranking.";

  }

  return(

    <View style={styles.card}>

      <View style={styles.header}>

        <View style={styles.iconContainer}>

          <Ionicons

            name="trophy"

            size={24}

            color="#FF9900"

          />

        </View>

        <View style={{flex:1}}>

          <Text style={styles.title}>

            Ranking da Cidade

          </Text>

          <Text style={styles.subtitle}>

            Sua posição nesta temporada

          </Text>

        </View>

      </View>

      <View style={styles.positionContainer}>

        <Text style={styles.medal}>

          {getMedal(cityRanking?.position)}

        </Text>

        <Text style={styles.position}>

          {

            cityRanking?.position

              ? `#${cityRanking.position}`

              : "--"

          }

        </Text>

        <Text style={styles.city}>

          {

            cityRanking?.city ||

            "Sua cidade"

          }

        </Text>

      </View>

      <View style={styles.progressArea}>

        <ProgressBar

          value={score}

          progressColor="#FF9900"

        />

      </View>

      <Text style={styles.score}>

        {score} pontos

      </Text>

      <View style={styles.messageBox}>

        <Ionicons

          name="rocket"

          size={18}

          color="#2563EB"

        />

        <Text style={styles.message}>

          {getMessage()}

        </Text>

      </View>

      <View style={styles.row}>

        <View style={styles.smallCard}>

          <Text style={styles.smallTitle}>

            Ranking da profissão

          </Text>

          <Text style={styles.smallValue}>

            {

              professionRanking?.position

                ? `#${professionRanking.position}`

                : "--"

            }

          </Text>

        </View>

        <View style={styles.smallCard}>

          <Text style={styles.smallTitle}>

            Distância do líder

          </Text>

          <Text style={styles.smallValue}>

            {distance}

          </Text>

        </View>

      </View>
            <View style={styles.rewardCard}>

        <View style={styles.rewardHeader}>

          <Ionicons
            name="gift"
            size={22}
            color="#FF9900"
          />

          <Text style={styles.rewardTitle}>
            Recompensa da Temporada
          </Text>

        </View>

        <Text style={styles.rewardName}>

          {reward?.title || "🏆 1 mês grátis no Tanamão+"}

        </Text>

        <Text style={styles.rewardDescription}>

          Continue evoluindo no ranking para conquistar esta recompensa exclusiva.

        </Text>

      </View>

      <View style={styles.goalCard}>

        <View style={styles.goalHeader}>

          <Ionicons
            name="flag"
            size={20}
            color="#2E4F2F"
          />

          <Text style={styles.goalTitle}>

            Próximo objetivo

          </Text>

        </View>

        {

          distance > 0 ? (

            <Text style={styles.goalText}>

              Você está a apenas{" "}

              <Text style={styles.bold}>

                {distance} pontos

              </Text>

              {" "}de conquistar a liderança da cidade.

            </Text>

          ) : (

            <Text style={styles.goalText}>

              👑 Você é o profissional mais bem colocado da cidade.

            </Text>

          )

        }

      </View>

      <View style={styles.footerCard}>

        <Ionicons

          name="time-outline"

          size={18}

          color="#6B7280"

        />

        <Text style={styles.footerText}>

          {

            season?.remainingDays

              ? `Restam ${season.remainingDays} dias para terminar esta temporada.`

              : "A temporada está em andamento."

          }

        </Text>

      </View>

    </View>

  );

}

const styles = StyleSheet.create({

  card:{

    backgroundColor:"#FFFFFF",

    borderRadius:26,

    padding:22,

    marginTop:18,

    shadowColor:"#000",

    shadowOpacity:0.06,

    shadowRadius:14,

    elevation:5,

  },

  header:{

    flexDirection:"row",

    alignItems:"center",

  },

  iconContainer:{

    width:50,

    height:50,

    borderRadius:25,

    backgroundColor:"#FFF5E6",

    justifyContent:"center",

    alignItems:"center",

    marginRight:14,

  },

  title:{

    fontSize:18,

    fontWeight:"700",

    color:"#2E4F2F",

  },

  subtitle:{

    color:"#6B7280",

    marginTop:2,

    fontSize:13,

  },

  positionContainer:{

    alignItems:"center",

    marginTop:22,

  },

  medal:{

    fontSize:42,

  },

  position:{

    marginTop:8,

    fontSize:46,

    fontWeight:"800",

    color:"#111827",

  },

  city:{

    marginTop:6,

    color:"#6B7280",

    fontSize:14,

  },

  progressArea:{

    marginTop:24,

  },

  score:{

    marginTop:10,

    textAlign:"center",

    color:"#6B7280",

    fontSize:13,

  },

  messageBox:{

    marginTop:22,

    backgroundColor:"#EFF6FF",

    borderRadius:18,

    padding:16,

    flexDirection:"row",

    alignItems:"flex-start",

  },

  message:{

    flex:1,

    marginLeft:10,

    color:"#1E3A8A",

    lineHeight:22,

    fontSize:14,

  },

  row:{

    flexDirection:"row",

    justifyContent:"space-between",

    marginTop:22,

  },

  smallCard:{

    flex:1,

    backgroundColor:"#F8FAFC",

    borderRadius:18,

    paddingVertical:18,

    marginHorizontal:4,

    alignItems:"center",

    borderWidth:1,

    borderColor:"#E5E7EB",

  },

  smallTitle:{

    color:"#6B7280",

    fontSize:13,

    textAlign:"center",

    marginBottom:8,

  },

  smallValue:{

    fontSize:28,

    fontWeight:"800",

    color:"#111827",

  },
    rewardCard:{

    marginTop:22,

    backgroundColor:"#FFF7ED",

    borderRadius:18,

    padding:18,

    borderWidth:1,

    borderColor:"#FDE68A",

  },

  rewardHeader:{

    flexDirection:"row",

    alignItems:"center",

    marginBottom:12,

  },

  rewardTitle:{

    marginLeft:10,

    fontSize:15,

    fontWeight:"700",

    color:"#92400E",

  },

  rewardName:{

    fontSize:22,

    fontWeight:"800",

    color:"#111827",

  },

  rewardDescription:{

    marginTop:8,

    color:"#92400E",

    fontSize:14,

    lineHeight:22,

  },

  goalCard:{

    marginTop:20,

    backgroundColor:"#ECFDF5",

    borderRadius:18,

    padding:18,

    borderWidth:1,

    borderColor:"#BBF7D0",

  },

  goalHeader:{

    flexDirection:"row",

    alignItems:"center",

    marginBottom:10,

  },

  goalTitle:{

    marginLeft:10,

    fontWeight:"700",

    fontSize:15,

    color:"#166534",

  },

  goalText:{

    color:"#166534",

    lineHeight:22,

    fontSize:14,

  },

  footerCard:{

    marginTop:20,

    flexDirection:"row",

    alignItems:"center",

    justifyContent:"center",

  },

  footerText:{

    marginLeft:8,

    color:"#6B7280",

    fontSize:13,

    textAlign:"center",

  },

  bold:{

    fontWeight:"800",

  },

});